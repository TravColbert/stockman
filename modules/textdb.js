(function(configObj){
  let db = {
    myName:configObj.dbName,
    idField:configObj.idField || "id",
    nextId:function() {
      let methodName = "nextId";
      let x = this.db.length;
      while(this.find(this.idField,x).length>0) {
        console.log(methodName + ": Checking ID: " + x);
        x++
      }
      return x;
    },
    add:function(record) {
      let methodName = 'add';
      if(this.find("id",record.id).length>0) {
        console.log("id already used");
        return false;
      }
      console.log(methodName + ": Pushing record: " + record.id + " " + JSON.stringify(record));
      this.db.push(record);
      return record.id;
    },
    search:function(searchString,field) {
      field = field || null;
      let results = this.db.filter(function(itemRecord) {
        let targetString = itemRecord.id.toLowerCase() + " " + itemRecord.owner.toLowerCase();
        return targetString.includes(searchString);
      });
      return results;
    },
    write:function(record) {
      let methodName = 'write';
      logThis(methodName + ": " + JSON.stringify(record));
      let index = this.findIndex(record.id);
      console.log("Cases DB: found existing index " + index);
      if(index==-1) {
        this.add(record);
      } else {
        this.db[index].time=record.time;
        this.db[index].owner=record.owner;
      }
      return true;
    },
    findIndex:function(caseId) {
      let methodName = 'findIndex';
      let index = this.db.findIndex(function(record) {
        return record.id==caseId;
      });
      return index;
    },
    find:function(field,val) {
      let methodName = "find";
      console.log(this.myName + ": " + methodName + ": Searching: " + field + " for: " + val);
      let part = this.db.filter(function(record) {
        return record[field]==val;
      },this);
      return part;
    },
    sort:function(compare) {
      let methodName = "sort";
      console.log(this.myName + ": " + methodName + ": Sorting db");
      compare = compare || null;
      let caseList = this.db;
      return caseList.sort(compare);
    },
    readDb:function(fileLocation) {
      let methodName = "readDb";
      fileLocation = fileLocation || configObj.dbName.dbFile;
      console.log(this.myName + ": " + methodName + ": Attempting read of stored data from " + fileLocation);
      fs.readFile(fileLocation,'utf8',function(err,data) {
        if(err) throw err;
        console.log("Read file!");
        this.db = JSON.parse(data);
        console.log(this.db);
        return true;
      }.bind(this));
      return;
    },
    writeDb:function() {
      let methodName = "writeDb";
      console.log(this.myName + ": " + methodName + ": Attempting write of in-memory data...");
      fs.writeFile(app.locals.casesDbFile,JSON.stringify(this.db),function(err) {
        if(err) {
          console.log(this.myName + ": " + methodName + ": Seems there was an error!");
          throw err;
        }
        console.log(this.myName + ": " + methodName + ": Write success!");
      }.bind(this));
      return;
    }
  }

  return db;
})();
