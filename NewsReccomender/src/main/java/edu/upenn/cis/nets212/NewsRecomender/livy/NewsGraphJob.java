package edu.upenn.cis.nets212.NewsRecomender.livy;
import edu.upenn.cis.nets212.config.Config;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;


import org.apache.spark.api.java.JavaPairRDD;
import org.apache.spark.api.java.JavaSparkContext;
import org.apache.spark.sql.SparkSession;

import edu.upenn.cis.nets212.NewsRecomender.Labels;
import edu.upenn.cis.nets212.NewsRecomender.Type;
import edu.upenn.cis.nets212.config.Config;
import edu.upenn.cis.nets212.storage.DynamoConnector;
import edu.upenn.cis.nets212.storage.SparkConnector;
import scala.Tuple2;


//Dynamo
import com.amazonaws.services.dynamodbv2.document.BatchWriteItemOutcome;
import com.amazonaws.services.dynamodbv2.document.DynamoDB;
import com.amazonaws.services.dynamodbv2.document.Item;
import com.amazonaws.services.dynamodbv2.document.ItemCollection;
import com.amazonaws.services.dynamodbv2.document.QueryOutcome;
import com.amazonaws.services.dynamodbv2.document.ScanOutcome;
import com.amazonaws.services.dynamodbv2.document.Table;
import com.amazonaws.services.dynamodbv2.document.TableWriteItems;
import com.amazonaws.services.dynamodbv2.model.WriteRequest;
import com.amazonaws.services.s3.AmazonS3;
import com.amazonaws.services.s3.AmazonS3Client;
import com.amazonaws.services.s3.model.GetObjectRequest;
import com.amazonaws.services.s3.model.S3Object;
import com.google.common.collect.Iterables;

//Other
import org.apache.livy.Job;
import org.apache.livy.JobContext;

public class NewsGraphJob implements Job<Integer> {
	private static final long serialVersionUID = 1L;
	
	SparkSession spark;
	
	JavaSparkContext context;

	DynamoDB db;
	
	final String userTableName="Users";
	
	final String bucketName = "articlesbucketg07";
	
	final String key = "articleIDs.txt";
	
	final String uploadTableName="NewsGraph";
	
	final String friendsTable = "Friends";
	
	private AmazonS3 s3Client;
	
	public Integer run() throws IOException, InterruptedException {
                //Set datastructures to be used by program
		Map<Integer,String> userLabels = new HashMap<Integer,String>();
		Map<String,Integer> userToInt = new HashMap<String,Integer>();
		Map<String,Integer> categoryLabels = new HashMap<String,Integer>();
		Map<Integer,String> articleToDate = new HashMap<Integer,String>();
		//Map<Integer,String> articleToDate = new HashMap<Integer,String>();
		List<Tuple2<Type, Type >>edgeList = new ArrayList<Tuple2<Type, Type >>();
		//int userCount = 0;
		int categoryCounter = 0; 
		//Read the S3 file
		S3Object object = s3Client.getObject(new GetObjectRequest(bucketName,key));
		InputStream objectData = object.getObjectContent();
		BufferedReader reader = new BufferedReader(new InputStreamReader(objectData));
		String line=null;
                // add (a,c),(c,a)
		while((line = reader.readLine())!=null && !line.isEmpty()) {
			String elements[] = line.split(",");
			int articleID = Integer.parseInt(elements[0]);
			String date = elements[2];
			String category = elements[1];
			articleToDate.put(articleID, date);
			categoryLabels.put(category, categoryCounter);
			Type articleType = new Type(1,articleID);
			Type categoryType = new Type(2,categoryCounter);
			edgeList.add(new Tuple2<Type,Type>(articleType,categoryType));
			edgeList.add(new Tuple2<Type,Type>(categoryType,articleType));
			categoryCounter++;
		}
		int userCounter = 0;
		//Scan the table and retrieve all the users
		
		//Initialize user tables and results
		Table users = db.getTable(userTableName);
		ItemCollection<ScanOutcome> userItems =users.scan();
		Iterator<Item> userIterator = userItems.iterator();
		//Initialize friends table
		Table friends = db.getTable(friendsTable);
		while(userIterator.hasNext()) {
			Item user = userIterator.next();
			String userName = (String)user.get("username");
			userToInt.put(userName, userCounter);
			userLabels.put(userCounter, userName);
			//Add all categories
			List<String> categories = user.getList("news_interest");
			for(String category:categories) {
				category = category.toUpperCase();
				if(!categoryLabels.containsKey(category)) {
					categoryLabels.put(category, categoryCounter);
					categoryCounter++;
				}
				int catNumber = categoryLabels.get(category);
                                // add (u,c),(c,u)
				edgeList.add(new Tuple2<Type,Type>(new Type(0,userCounter),new Type(2,catNumber)));
				edgeList.add(new Tuple2<Type,Type>(new Type(2,catNumber),new Type(0,userCounter)));
			}
			List<BigDecimal>likedArticles = user.getList("likedArticles");
			for(BigDecimal articleIdentBig:likedArticles) {
				int articleIdent = articleIdentBig.intValue();
				//Workaround since DynamoDB can't handle empty list upload
				if(articleIdent==-1) {
					continue;
				}
                                // add (u,a),(a,u)
				edgeList.add(new Tuple2<Type,Type>(new Type(0,userCounter),new Type(1,articleIdent)));
				edgeList.add(new Tuple2<Type,Type>(new Type(1,articleIdent),new Type(0,userCounter)));
			}
			userCounter++;
			
		}
                //add (u,u') and (u',u)
		for(String username:userLabels.values()) {
			ItemCollection<QueryOutcome>userFriendsQuery = friends.query("username",username);
			Iterator<Item>friendsIterator = userFriendsQuery.iterator();
			while(friendsIterator.hasNext()) {
				Item userFriendItem = friendsIterator.next();
				String userFriend = userFriendItem.getString("friend");
				int userLabel = userToInt.get(username);
				int friendLabel = userToInt.get(userFriend);
				edgeList.add(new Tuple2<Type,Type>(new Type(0,userLabel),new Type(0,friendLabel)));
				edgeList.add(new Tuple2<Type,Type>(new Type(0,friendLabel),new Type(0,userLabel)));			
			}
		}
		
		final int userCount = userCounter;
                //stores pairs
		JavaPairRDD<Type,Type>edgeLinks = context.parallelizePairs(edgeList,Config.PARTITIONS).distinct();
		
		//Check if categories have been selected by users
		JavaPairRDD<Type,Double>categoryUserLinks = edgeLinks.filter(x->(x._1.isCategory()&&x._2.isUser()))
				.mapToPair(x->new Tuple2<Type,Double>(x._1,1.0)).reduceByKey((a,b)->a+b)
				.mapToPair(item->new Tuple2<Type,Double>(item._1,0.5/item._2));
		
		JavaPairRDD<Type,Tuple2<Type,Double>> weightedGraph = edgeLinks.filter(x->x._1.isCategory() && x._2.isUser()).join(categoryUserLinks);
		//Check if portion of graph needs to have increased weight
		if(categoryUserLinks.isEmpty()) {
			JavaPairRDD<Type,Double>categoryArticleLinks = edgeLinks.filter(x->(x._1.isCategory()&&x._2.isArticle()))
					.mapToPair(x->new Tuple2<Type,Double>(x._1,1.0)).reduceByKey((a,b)->a+b)
					.mapToPair(item->new Tuple2<Type,Double>(item._1,1.0/item._2));
		    weightedGraph=weightedGraph.union(edgeLinks.filter(x->x._1.isCategory() && x._2.isArticle()).join(categoryArticleLinks));
		}
		else {
			JavaPairRDD<Type,Double>categoryArticleLinks = edgeLinks.filter(x->(x._1.isCategory()&&x._2.isArticle()))
					.mapToPair(x->new Tuple2<Type,Double>(x._1,1.0)).reduceByKey((a,b)->a+b)
					.mapToPair(item->new Tuple2<Type,Double>(item._1,0.5/item._2));
		    weightedGraph=weightedGraph.union(edgeLinks.filter(x->x._1.isCategory() && x._2.isArticle()).join(categoryArticleLinks));
		}
		//Do articles now
		JavaPairRDD<Type,Double>articleUserLinks = edgeLinks.filter(x->(x._2.isUser()&&x._1.isArticle()))
				.mapToPair(x->new Tuple2<Type,Double>(x._1,1.0)).reduceByKey((a,b)->a+b)
				.mapToPair(item->new Tuple2<Type,Double>(item._1,0.5/item._2));

	    weightedGraph=weightedGraph.union(edgeLinks.filter(x->x._1.isArticle() && x._2.isUser()).join(articleUserLinks));
		//Check if portion of graph needs to have increased weight
		if(articleUserLinks.isEmpty()) {
			JavaPairRDD<Type,Double>articleCategoryLinks=(edgeLinks.filter(x->(x._2.isCategory()&&x._1.isArticle()))
					.mapToPair(x->new Tuple2<Type,Double>(x._1,1.0)).reduceByKey((a,b)->a+b)
					.mapToPair(item->new Tuple2<Type,Double>(item._1,1.0/item._2)));
		    weightedGraph=weightedGraph.union(edgeLinks.filter(x->x._1.isArticle() && x._2.isCategory()).join(articleCategoryLinks));
		}
     
		else {
			JavaPairRDD<Type,Double>articleCategoryLinks=(edgeLinks.filter(x->(x._2.isCategory()&&x._1.isArticle()))
					.mapToPair(x->new Tuple2<Type,Double>(x._1,1.0)).reduceByKey((a,b)->a+b)
					.mapToPair(item->new Tuple2<Type,Double>(item._1,0.5/item._2)));
		    weightedGraph=weightedGraph.union(edgeLinks.filter(x->x._1.isArticle() && x._2.isCategory()).join(articleCategoryLinks));
		}

		//Now calculate user links
		//User-User
		JavaPairRDD<Type,Double>user_userLinks = edgeLinks.filter(x->(x._1.isUser()&&x._2.isUser()))
				.mapToPair(x->new Tuple2<Type,Double>(x._1,1.0)).reduceByKey((a,b)->a+b)
				.mapToPair(item->new Tuple2<Type,Double>(item._1,0.3/item._2));
		//User-Article
		JavaPairRDD<Type,Double>user_articleLinks = edgeLinks.filter(x->(x._1.isUser()&&x._2.isArticle()))
				.mapToPair(x->new Tuple2<Type,Double>(x._1,1.0)).reduceByKey((a,b)->a+b)
				.mapToPair(item->new Tuple2<Type,Double>(item._1,0.4/item._2));
		//User-Category
		JavaPairRDD<Type,Double>user_categoryLinks = edgeLinks.filter(x->(x._1.isUser()&&x._2.isCategory()))
				.mapToPair(x->new Tuple2<Type,Double>(x._1,1.0)).reduceByKey((a,b)->a+b)
				.mapToPair(item->new Tuple2<Type,Double>(item._1,0.3/item._2)); 
		
		//See if we need to recompute weights to avoid missing weights
		if(user_userLinks.isEmpty()) {
			user_articleLinks=user_articleLinks.mapToPair(item->new Tuple2<Type,Double>(item._1,item._2*1.625));
			user_categoryLinks=user_categoryLinks.mapToPair(item->new Tuple2<Type,Double>(item._1,item._2*1.5));
		}
		if(user_articleLinks.isEmpty()) {
			user_userLinks=user_articleLinks.mapToPair(item->new Tuple2<Type,Double>(item._1,item._2*1.6667));
			user_categoryLinks=user_categoryLinks.mapToPair(item->new Tuple2<Type,Double>(item._1,item._2*1.666667));
		}
		if(user_userLinks.isEmpty() && user_articleLinks.isEmpty()) {
			user_categoryLinks=user_categoryLinks.mapToPair(item->new Tuple2<Type,Double>(item._1,item._2*1.3333333));
		}
		//Add everything to the weighted graph
		weightedGraph=weightedGraph.union(edgeLinks.filter(x->x._1.isUser() && x._2.isUser()).join(user_userLinks));
		weightedGraph=weightedGraph.union(edgeLinks.filter(x->x._1.isUser() && x._2.isArticle()).join(user_articleLinks));
		weightedGraph=weightedGraph.union(edgeLinks.filter(x->x._1.isUser() && x._2.isCategory()).join(user_categoryLinks));
		/*
		List<Tuple2<Type,Tuple2<Type,Double>>> results= weightedGraph.collect();

		 * Graph Printing
		for(Tuple2<Type,Tuple2<Type,Double>>result:results) {
			System.out.print("U: "+result._1);
			System.out.print(", V: "+result._2._1);
			System.out.println(", Weight: "+result._2._2);
		}
		*/
		//Create the RDD which maps Types to weights.
		
		JavaPairRDD<Type,Labels>adsorbRDD = edgeLinks.filter(x->!x._1.isUser()).map(x->x._1).distinct().mapToPair(x->new Tuple2<Type,Labels>(x,new Labels(userCount,-1)));
		adsorbRDD=adsorbRDD.union(edgeLinks.filter(x->x._1.isUser()).map(x->x._1).distinct().mapToPair(x->new Tuple2<Type,Labels>(x,new Labels(userCount,x.getUser()))));
		int maxIter = 15;
		double dMax = 0.003*userCount;
		//Note that graph is undirected--thus is symmetric, thus we can assume (b,p) format
		for(int i=0;i<maxIter;i++) {
			//Initialize previous values
			JavaPairRDD<Type,Labels>prevRDD = adsorbRDD;
			JavaPairRDD<Type,Labels>propogateRDD = weightedGraph.join(adsorbRDD)
					.mapToPair(x->new Tuple2<Type,Labels>(x._2._1._1, x._2._2.weightIfy(x._2._1._2)));
			adsorbRDD = propogateRDD.reduceByKey((a,b)->a.adsorb(b)).mapToPair(x->new Tuple2<Type,Labels>(x._1,x._2));
			//Normalize these values
			adsorbRDD = adsorbRDD.mapToPair(x->new Tuple2<Type,Labels>(x._1,x._2.normalize(x._1.getUser())));
			double signal = adsorbRDD.join(prevRDD).values().map(x->{return x._1.diffCalc(x._2)<dMax ? 1:0;}).reduce((x,y)->x*y);
			/*
			List<Tuple2<Type,Labels>>cool = adsorbRDD.collect();
			for(Tuple2<Type,Labels>cooler:cool) {
				System.out.println(i);
				System.out.print("Type: "+cooler._1);
				System.out.println(", Labels: "+cooler._2+"\n\n");
			}
			*/
			if(signal==1) {
				break;
			}
		}


		JavaPairRDD<Type, Labels>articlesRDD = adsorbRDD.filter(x->x._1.isArticle());
		//Threshold
		final double threshold = (0.01);
		//Filters through values, removing unnecessarily low and choosing top 100 of same weighted articles--in low user cases
		JavaPairRDD<Type,Tuple2<Integer,Double>>articleCollection = articlesRDD
				//Convert labels to double array
				.mapToPair(x->new Tuple2<Type,List<Tuple2<Double,Integer>>>(x._1,x._2.getLabelList()))
				.flatMapValues(x->x.iterator())
				.filter(x->x._2._1>threshold)
				.mapToPair(x->x.swap())
				.groupByKey()
				.mapToPair(x->new Tuple2<Tuple2<Double,Integer>,Iterable<Type>>(x._1,Iterables.limit(x._2, 100)))
				.flatMapValues(x->x.iterator())
				.mapToPair(x->x.swap())
				.mapToPair(x->new Tuple2<Type,Tuple2<Integer,Double>>(x._1,new Tuple2<Integer,Double>(x._2._2,x._2._1)));
		List<Tuple2<Type,Tuple2<Integer,Double>>>uploadArticleUser = articleCollection.collect();
		/*
		 * Old way--too many values
		List<Tuple2<Type,Labels>>articleCollection = articlesRDD.collect();
		List<Tuple2<Type,Tuple2<Integer, Double>>>uploadArticleUser= new ArrayList<Tuple2<Type,Tuple2<Integer, Double>>>();
		for(Tuple2<Type,Labels> aElement:articleCollection) {
			for(int i=0;i<userCount;i++) {
				if(aElement._2.get(i)>threshold) {
					final int userIndex = i;
					final double weight = aElement._2.get(i);
					uploadArticleUser.add(new Tuple2<Type,Tuple2<Integer, Double>>(aElement._1,new Tuple2<Integer,Double>(userIndex,weight)));
				}
			}
		}
		*/
		//Take top 100ish articles for each user and upload:
			Iterator<Tuple2<Type,Tuple2<Integer, Double>>>it = uploadArticleUser.iterator();
			ArrayList<Item> items = new ArrayList<Item>();
			int count=1;
			while(it.hasNext()) {
				Tuple2<Type,Tuple2<Integer, Double>>uploadMe = it.next();
				Item item = new Item().withPrimaryKey("username", userLabels.get(uploadMe._2._1),"articleID", uploadMe._1.getArticle()).with("W", uploadMe._2._2).with("Date", articleToDate.get(uploadMe._1.getArticle()));
				items.add(item);
				//Load items into list untill we have reached max size for batchWrite
				if(count<25)
				{
					count++;
				}
				if(count>=25 || !it.hasNext())
				{
					try {
						TableWriteItems writeTable = new TableWriteItems(uploadTableName).withItemsToPut(items);
						BatchWriteItemOutcome outcome = db.batchWriteItem(writeTable);
			            while (outcome.getUnprocessedItems().size() > 0) {
			                Map<String, List<WriteRequest>> unprocessedItems = outcome.getUnprocessedItems();
			                if (outcome.getUnprocessedItems().size() > 0){		   
			                    outcome = db.batchWriteItemUnprocessed(unprocessedItems);
			                }		            
			            }
			            items.clear();
			            count = 1;
					}
					catch(Exception e)
					{
						System.out.println("Falure loading data");
						e.printStackTrace();
					}
				}
			}
			System.out.println("Finished Building Graph!");

		//Print articles
		/*
		for(Tuple2<Type,Labels>cooler:articlesResults) {
			System.out.print("Type: "+cooler._1);
			System.out.println(", Labels: "+cooler._2+"\n\n");
		}
		*/
		return 1;
	}
	
	public void initialize() throws IOException, InterruptedException {
		System.out.println("Connecting to Spark...");
		spark = SparkConnector.getSparkConnection();
		context = SparkConnector.getSparkContext();
		db = DynamoConnector.getConnection(Config.DYNAMODB_URL);
		s3Client = new AmazonS3Client();
		
		System.out.println("Connected!");
	}
	public NewsGraphJob() {
		System.setProperty("file.encoding", "UTF-8");
	}
	@Override
	public Integer call(JobContext arg0) throws Exception {
		initialize();
		return run();
	}

}

