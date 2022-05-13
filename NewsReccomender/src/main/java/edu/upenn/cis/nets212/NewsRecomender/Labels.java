package edu.upenn.cis.nets212.NewsRecomender;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import scala.Tuple2;



public class Labels implements Serializable {
	//Indices correspond to users
	double labels[];
	public Labels() {
		this.labels = new double[0];
	}
	public Labels(int userSize, int userId) {
		this.labels = new double[userSize];
		if(userId>-1) {
			labels[userId]=1;
		}
	}
	public Labels(double labels[]) {
		this.labels = labels;
	}
	public Labels weightIfy(double weight) {
		double newLabels[] = new double[this.labels.length];
		for(int i=0;i<newLabels.length;i++) {
			newLabels[i] = labels[i]*weight;
		}
		return new Labels(newLabels);
	}
	public Labels adsorb(Labels other) {
		//Check if base initialization
		double newLabels[] = new double[other.labels.length];
		if(this.labels.length==0) {
			this.labels = new double[other.labels.length];
		}
		for(int i=0;i<this.labels.length;i++) {
			newLabels[i]=this.labels[i]+(other.labels[i]);
		}
		return new Labels(newLabels);
	}
	public Labels normalize(int userId) {
		double newLabels[]= new double[this.labels.length];
		double sum=0;
		for(int i=0;i<this.labels.length;i++) {
			if(i==userId) {
				newLabels[i]=1;
			}
			else {
				sum+=labels[i];
			}
		}
		if(sum>0) {
		    for(int i=0;i<this.labels.length;i++) {
			    if(i!=userId) {
				    newLabels[i]=this.labels[i]/sum;
			    }
		    }
		}
		return new Labels(newLabels);
	}
	public double get(int index) {
		return this.labels[index];
	}
	public Double diffCalc(Labels other) {
                //returns difference between two labels, useful for calculating delta between two iterations
		double diff = 0;
		for(int i=0;i<this.labels.length;i++) {
			diff+=(Math.abs(this.labels[i]-other.labels[i]));
		}
		return new Double(diff);
	}
        //Return as specified list
	public List<Tuple2<Double,Integer>> getLabelList(){
		List<Tuple2<Double,Integer>>returnMe = new ArrayList<Tuple2<Double,Integer>>();
		for(int i=0;i<this.labels.length;i++) {
			returnMe.add(new Tuple2<Double,Integer>(this.labels[i],i));
		}
		return returnMe;
	}
	@Override
	public int hashCode() {
		return Arrays.hashCode(labels);
	}
	@Override
	public boolean equals(Object o) {
		Labels other = (Labels) o;
		for(int i=0;i<labels.length;i++) {
			if(this.labels[i]!=other.labels[i]) {
				return false;
			}
		}
		return true;
	}
	@Override
	public String toString() {
		return Arrays.toString(labels);
	}
}
