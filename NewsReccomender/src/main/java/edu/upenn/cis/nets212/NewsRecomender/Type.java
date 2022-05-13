package edu.upenn.cis.nets212.NewsRecomender;

import java.io.Serializable;

public class Type implements Serializable {
	int arr[];
        //arr[0] represents user
        //arr[1] represents article
        //arr[2] represents category
	public Type(int type,int value) {
		arr = new int[3];
		arr[0]=-1;
		arr[1]=-1;
		arr[2]=-1;
		arr[type] = value;
	}
	public boolean isUser() {
		return (arr[0]>=0);
	}
	public boolean isArticle() {
		return (arr[1]>=0);
	}
	public boolean isCategory() {
		return (arr[2]>=0);
	}
	public int getUser() {
		return arr[0];
	}
	public int getArticle() {
		return arr[1];
	}
	public int getCategory() {
		return arr[2];
	}
	@Override
	public String toString() {
		if(isUser()) {
			return ("User Id: "+arr[0]);
		}
		else if(isArticle()) {
			return ("Article Id: "+arr[1]);
		}
		else if(isCategory()) {
		return("Category Id: "+arr[2]);
		}
		return "This jaunt broke";
	}
	@Override
	public int hashCode() {
		return arr[0]+10*arr[1]+100*arr[2];
	}
	@Override
	public boolean equals(Object o) {
		Type other = (Type)o;
		for(int i=0;i<3;i++) {
			if(this.arr[i]!=other.arr[i]) {
				return false;
			}
		}
		return true;
	}

}
