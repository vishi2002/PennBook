package edu.upenn.cis.nets212.NewsRecomender.livy;
import java.io.File;

import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutionException;
import org.apache.livy.LivyClient;
import org.apache.livy.LivyClientBuilder;

import com.amazonaws.services.dynamodbv2.document.DynamoDB;
import com.amazonaws.services.dynamodbv2.document.Item;
import com.amazonaws.services.dynamodbv2.document.ItemCollection;
import com.amazonaws.services.dynamodbv2.document.QueryOutcome;
import com.amazonaws.services.dynamodbv2.document.Table;
import com.amazonaws.services.dynamodbv2.document.spec.QuerySpec;
import com.amazonaws.services.dynamodbv2.document.utils.ValueMap;

import edu.upenn.cis.nets212.config.Config;
import edu.upenn.cis.nets212.storage.DynamoConnector;

public class NewsGraphUpdater {
	static DynamoDB db;
	public static void main(String[] args) throws IOException, URISyntaxException, InterruptedException, ExecutionException {
		//In this case simply update the user, not the entire graph
		if(args[0].equals("1")) {
			updateUser(args[1]);
			System.exit(0);
		}
		LivyClient client = new LivyClientBuilder()
				  .setURI(new URI("http://ec2-54-197-21-31.compute-1.amazonaws.com:8998/"))
				  .build();

		try {
			String jar = "target/news_recommender-0.0.1-SNAPSHOT.jar";
			
		  System.out.printf("Uploading %s to the Spark context...\n", jar);
		  
		  client.uploadJar(new File(jar)).get();
		  
		  System.out.println("Updating the Graph Network");
		  
		  Integer result = client.submit(new NewsGraphJob()).get();
		  
		  System.out.println("Job finished with status code: "+result);
		  
		} finally {
		  client.stop(true);
		//In this case update a user after updating the graph
		if(args[0].equals("2")) {
			updateUser(args[1]);
		}
		}
	}

	public static void updateUser(String username) {
		db = DynamoConnector.getConnection(Config.DYNAMODB_URL);
		final String seen = "SeenArticles";
		final String newsGraph = "NewsGraph";
		Table seenTable = db.getTable(seen);
		Table graphTable = db.getTable(newsGraph);
		//Get the set of articles already seen by the user
		QuerySpec querySpec = new QuerySpec().withKeyConditionExpression("username =:uu")
				                      .withValueMap(new ValueMap()
				                      .with(":uu", username));
		ItemCollection<QueryOutcome> seenOutcome = seenTable.query(querySpec);
		Iterator<Item>articleNames = seenOutcome.iterator();
		int nextOrd = 0;
		Set<Integer>seenArticles = new HashSet<Integer>();
		while(articleNames.hasNext()) {
			Item articleRec = articleNames.next();
			nextOrd = Math.max(nextOrd, articleRec.getInt("ordNum"));
			seenArticles.add(articleRec.getInt("articleID"));
		}
		nextOrd+=1;
		String queryDate = LocalDate.now().toString().substring(0,4);
		final Map<String,String>expression = new HashMap<String,String>();
		expression.put("#d", "Date");
                //Searches the weighted graph
		QuerySpec spec = new QuerySpec().withKeyConditionExpression("username = :uu")
				                        .withFilterExpression("contains(#d, :dd)")
				                        .withNameMap(expression)
				                        .withValueMap(new ValueMap()
				                        .with(":uu", username)
				                        .with(":dd", queryDate)
				                        );
		ItemCollection<QueryOutcome>articleRecOutcome = graphTable.query(spec);
                //If no articles found in 2021, pick random.
                if(!articleRecOutcome.iterator().hasNext()){
                        spec = new QuerySpec().withKeyConditionExpression("username = :uu")
                                                        .withValueMap(new ValueMap()
                                                        .with(":uu", username)
                                                        );
                        articleRecOutcome = graphTable.query(spec);
                }
		double sum = 0;
		Iterator<Item> articleRecIterator = articleRecOutcome.iterator();
		List<Item> validArticles = new ArrayList<Item>();
		while(articleRecIterator.hasNext()) {
			Item articleRec = articleRecIterator.next();
			if(seenArticles.contains(articleRec.getBigInteger("articleID").intValue())) {
				continue;
			}
			sum+=articleRec.getDouble("W");
			validArticles.add(articleRec);
		}
                //Normalize articles
		double numbaLine[] = new double[validArticles.size()];
		double runningSum =0;
		for(int i=0;i<numbaLine.length;i++) {
			//normalize and add to the running sum
			runningSum+=(validArticles.get(i).getDouble("W")/sum);
			numbaLine[i] = runningSum;
		}
		//Pick randomly
		double randNum = Math.random();
		int pickedArticleIndex = 0;
		for(int i=0;i<numbaLine.length;i++) {
			if(numbaLine[i]>randNum) {
				pickedArticleIndex = i;
				break;
			}
		}
		if(validArticles.size()>0) {
		Item pickedArticle = validArticles.get(pickedArticleIndex);
		//Now upload the picked article to the articles seen database
		int articleID = pickedArticle.getInt("articleID");
		Item uploadSeenArticle = new Item().withPrimaryKey("username", username).with("articleID", articleID).with("ordNum", nextOrd);
		seenTable.putItem(uploadSeenArticle);
	}
}

}
