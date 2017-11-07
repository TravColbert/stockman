const nodemailer = require('nodemailer');
const fs = require('fs');
let app = {};
app.locals = JSON.parse(fs.readFileSync('config.json'));
app.locals.url = app.locals.addr + ":" + app.locals.port;
// app.options = {
//   key: fs.readFileSync(app.locals.keyFile),
//   cert: fs.readFileSync(app.locals.certFile)
// }

console.log(app.locals);

// let cases = {
//   myName:"casedb",
//   add:function(caseRecord) {
//     let methodName = 'add';
//     if(this.find("id",caseRecord.id).length>0) return false;
//     console.log(methodName + ": Pushing record: " + caseRecord.id + " " + JSON.stringify(caseRecord));
//     this.db.push({
//       id:caseRecord.id,
//       time:caseRecord.time,
//       owner:caseRecord.owner
//     });
//     return caseRecord.id;
//   },
//   search:function(searchString,field) {
//     field = field || null;
//     let results = this.db.filter(function(itemRecord) {
//       let targetString = itemRecord.id.toLowerCase() + " " + itemRecord.owner.toLowerCase();
//       return targetString.includes(searchString);
//     });
//     return results;
//   },
//   write:function(caseRecord) {
//     let methodName = 'write';
//     logThis(methodName + ": " + JSON.stringify(caseRecord));
//     let index = this.findIndex(caseRecord.id);
//     console.log("Cases DB: found existing index " + index);
//     if(index==-1) {
//       this.add(caseRecord);
//     } else {
//       this.db[index].time=caseRecord.time;
//       this.db[index].owner=caseRecord.owner;
//     }
//     return true;
//   },
//   findIndex:function(caseId) {
//     let methodName = 'findIndex';
//     let index = this.db.findIndex(function(record) {
//       return record.id==caseId;
//     });
//     return index;
//   },
//   find:function(field,val) {
//     let methodName = "find";
//     console.log(this.myName + ": " + methodName + ": Searching: " + field + " for: " + val);
//     let part = this.db.filter(function(record) {
//       return record[field]==val;
//     },this);
//     return part;
//   },
//   sort:function(compare) {
//     let methodName = "sort";
//     console.log(this.myName + ": " + methodName + ": Sorting db");
//     compare = compare || null;
//     let caseList = this.db;
//     return caseList.sort(compare);
//   },
//   readDb:function(fileLocation) {
//     let methodName = "readDb";
//     fileLocation = fileLocation || app.locals.casesDbFile;
//     console.log(this.myName + ": " + methodName + ": Attempting read of stored data from " + fileLocation);
//     fs.readFile(fileLocation,'utf8',function(err,data) {
//       if(err) throw err;
//       console.log("Read file!");
//       this.db = JSON.parse(data);
//       console.log(this.db);
//       return true;
//     }.bind(this));
//     return;
//   },
//   writeDb:function() {
//     let methodName = "writeDb";
//     console.log(this.myName + ": " + methodName + ": Attempting write of in-memory data...");
//     fs.writeFile(app.locals.casesDbFile,JSON.stringify(this.db),function(err) {
//       if(err) {
//         console.log(this.myName + ": " + methodName + ": Seems there was an error!");
//         throw err;
//       }
//       console.log(this.myName + ": " + methodName + ": Write success!");
//     }.bind(this));
//     return;
//   }
// }

// cases.readDb();

// let parts = {
//   myName:"partdb",
//   add:function(part) {
//     let methodName = 'add';
//     let x=this.db.length;
//     while(this.find("id",x).length>0) {
//       console.log(methodName + ": Checking ID: " + x);
//       x++;
//     }
//     console.log(methodName + ": Pushing record: " + x + " " + JSON.stringify(part));
//     this.db.push({
//       id:x,
//       partnum:part.partnum,
//       description:part.description,
//       make:part.make,
//       count:part.count,
//       cases:[]
//     });
//     return x;
//   },
//   search:function(searchString,field) {
//     let methodName = "partsearch";
//     console.log(methodName + ": Searching for: " + searchString);
//     field = field || null;
//     let targetString;
//     let results = this.db.filter(function(itemRecord) {
//       targetString = '';
//       if(itemRecord.partnum)
//         targetString += itemRecord.partnum.toLowerCase() + " ";
//       if(itemRecord.partaltnum)
//         targetString += itemRecord.partaltnum.toLowerCase() + " ";
//       if(itemRecord.description)
//         targetString += itemRecord.description.toLowerCase() + " ";
//       if(itemRecord.make)
//         targetString += itemRecord.make.toLowerCase();
//       // console.log(targetString);
//       // console.log(targetString.indexOf(searchString));
//       return targetString.includes(searchString);
//     });
//     console.log(methodName + ": Found " + results.length + " records");
//     return results;
//   },
//   find:function(field,val) {
//     let methodName = "find";
//     console.log(this.myName + ": " + methodName + ": Searching: " + field + " for: " + val);
//     let part = this.db.filter(function(partRecord) {
//       return partRecord[field]==val;
//     },this);
//     return part;
//   },
//   findByCase:function(caseNum) {
//     let methodName = 'findByCase';
//     console.log(this.myName + ": " + methodName + ": Searching for parts by case #: " + caseNum);
//     let parts = this.db.filter(function(partRecord) {
//       return (partRecord.cases.indexOf(caseNum)>-1);
//     },this);
//     return parts;
//   },
//   countFree:function(id) {
//     let methodName = 'countFree';
//     let record = this.find('id',id);
//     console.log(this.myName + ": " + methodName + ": Found: " + record.length + " records");
//     if(record.length<1) return false;
//     console.log(this.myName + ": " + methodName + ": Number of CHECKED-OUT units: " + record[0].cases.length);
//     return (record[0].count - record[0].cases.length);
//   },
//   countUsed:function(id) {
//     let methodName = 'countUsed';
//     let record = this.find('id',id);
//     console.log(this.myName + ": " + methodName + ": Found: " + record.length + " records");
//     if(record.length<1) return false;
//     console.log(this.myName + ": " + methodName + ": Number of CHECKED-OUT units: " + record[0].cases.length);
//     return record[0].cases.length;
//   },
//   getCases:function() {
//     let methodName = 'getCases';
//     let caseList = [];
//     this.db.forEach(function(v,i,a) {
//       console.log(parts.myName + ": " + methodName + ": Getting caselist for part: " + v.id + " (" + JSON.stringify(v.cases) + ")");
//       let partCases = v.cases.filter(function(c) {
//         return caseList.indexOf(c)==-1;
//       })
//       console.log(parts.myName + ": " + methodName + ": Got this: " + v.id + " (" + JSON.stringify(partCases) + ")");
//       caseList = caseList.concat(partCases);
//     });
//     caseList.sort();
//     console.log(this.myName + ": " + methodName + ": Case list:" + JSON.stringify(caseList));
//     return caseList;
//   },
//   /**
//    * Checking in and out parts is a matter of adding and removing case numbers from an
//    * array in the part record.
//    * To check-out : add a case number to the array
//    * To check-in : remove a case number from the array
//    *
//    * The 'count' property now indicates the total desired parts in the stock
//    */

//   /**
//    * Checking-in will involve submitting am ID indicating the part and a case (or cases)
//    * That list of cases will be removed from the 'cases' property.
//    */
//   checkin:function(id,cases) {
//     let delCase = function(index,caseNum) {
//       console.log("delCase: Deleting case#: " + caseNum + " from part at index: " + index);
//       let idx = parts.db[index].cases.indexOf(cases);  // Find the position of the case
//       if(idx<0) {
//         console.log("delCase: Couldn't find that case # (" + caseNum + ") in the case list (" + JSON.stringify(parts.db[index].cases) + ")");
//         return false;
//       }
//       console.log("delCase: Found case#: " + caseNum + " at index : " + idx + " in case list");
//       // What if multiple parts were checked-out for one case?
//       if(parts.db[index].cases.splice(idx,1).length==0) return false;
//       return true;
//     };
//     let partIndex = this.db.findIndex(function(v) {
//       return v.id==id;
//     });
//     if(partIndex<0) return false;     // No parts found

//     if(!Array.isArray(cases)) {
//       // Assigning one part into a case...
//       console.log("Free + 1: " + (this.countFree(id)+1) + " Count: " + this.db[partIndex].count);
//       if((this.countFree(id)+1)>this.db[partIndex].count) return false;  // Can't assign any more parts to cases (more than the stock number)
//       return delCase(partIndex,cases);
//     }
//     if((this.countFree(id)-cases.length)<0) return false;  // Can't assign any more parts to cases (none left)
//     let success = true;
//     cases.forEach(function(v,i,a) {
//       if(!delCase(partIndex,v)) success=false;
//     });
//     return success;
//     // this.db[partIndex].count += num;
//     // return true;
//   },
//   /**
//    * Checking-out will involve submitting am ID indicating the part and a case (or cases)
//    * That list of cases will be added to the 'cases' property.
//    */
//   checkout:function(id,cases) {
//     let methodName = 'checkout';
//     console.log(this.myName + ": " + methodName + ": Searching: " + id + " for: " + JSON.stringify(cases));
//     let partIndex = this.db.findIndex(function(v) {
//       return v.id==id;
//     });
//     if(partIndex<0) return false;     // No parts found
//     if(!Array.isArray(cases)) {
//       // Assigning one part into a case...
//       if((this.countFree(id)-1)<0) return false;  // Can't assign any more parts to cases (none left)
//       this.db[partIndex].cases.push(cases);
//     } else {
//       if((this.countFree(id)-cases.length)<0) return false;  // Can't assign any more parts to cases (none left)
//       this.db[partIndex].cases.concat(cases);
//     }
//     return true;
//   },
//   readDb:function() {
//     let methodName = "readDb";
//     console.log(this.myName + ": " + methodName + ": Attempting read of stored parts data...");
//     fs.readFile(app.locals.partsDbFile,'utf8',function(err,data) {
//       if(err) throw err;
//       this.db = JSON.parse(data);
//       // console.log(JSON.stringify(this.db));
//       return true;
//     }.bind(this));
//     return;
//   },
//   writeDb:function() {
//     let methodName = "writeDb";
//     console.log(this.myName + ": " + methodName + ": Attempting write of in-memory data...");
//     fs.writeFile(app.locals.partsDbFile,JSON.stringify(this.db),function(err) {
//       if(err) {
//         console.log(this.myName + ": " + methodName + ": Seems there was an error!");
//         throw err;
//       }
//       console.log(this.myName + ": " + methodName + ": Write success!");
//     }.bind(this));
//     return;
//   }
// };

// parts.readDb();

// /**
//  * The Users DB with functions that hook into Passport
//  */
// let users = {
//   myName:"userdb",
//   findByUsername:function(username,cb) {
//     let methodName = "findByUsername";
//     console.log(this.myName + ": " + methodName + ": Checking for name:" + username);
//     let user = this.find("username",username)[0];
//     if(user) {
//       console.log(this.myName + ": " + methodName + ": Found a username that matches",username);
//       cb(null,user);
//       return;
//     }
//     console.log(this.myName + ": " + methodName + ": No account found");
//     cb(null,false);
//     return;
//   },
//   findById:function(id,cb) {
//     let methodName = "findById";
//     console.log(this.myName + ": " + methodName + ": Checking for ID:" + id);
//     let user = this.find("id",id)[0];
//     if(user) {
//       console.log(this.myName + ": " + methodName + ": Found user record that matches ID",id);
//       cb(null,user);
//       return;
//     }
//     console.log(this.myName + ": " + methodName + ": No account found");
//     cb(null,false);
//     return;
//   },
//   find:function(field,val) {
//     let methodName = "find";
//     console.log(this.myName + ": " + methodName + ": Searching: ",field," for: ",val);
//     let user = this.db.filter(function(userRecord) {
//       return userRecord[field]==val;
//     },this);
//     return user;
//   },
//   add:function(userObj) {
//     let checkPw = function(user) {
//       if(user.password!=user.passwordv) {
//         req.session.messages.push(makeMessage({type:"warn",text:"Passwords do not match"}));
//         return false;
//       }
//       return true;
//     }
//     let getNextIndex = function(userDb) {
//       let x=userDb.db.length;
//       while(userDb.find("id",x).length>0) {
//         x++;
//       }
//       return x;
//     }
//     let hashPw = function(user,db) {
//       if(!user.hasOwnProperty('password')) return false;
//       bcrypt.genSalt(10,function(err,salt) {
//         bcrypt.hash(user.password,salt,function(err,hash) {
//           user.password = hash;
//           console.log("user: add: hashPw: User to save: " + JSON.stringify(user));
//           db.db.push(user);
//           db.writeDb();
//         });
//       });
//     }
//     if(!checkPw(userObj)) return false;
//     hashPw({
//       id:getNextIndex(this),
//       username:userObj.username,
//       email:userObj.email,
//       password:userObj.password
//     },this);
//     return true;
//   },
//   search:function(searchString,field) {
//     field = field || "username";
//     let results = this.db.filter(function(itemRecord) {
//       return itemRecord[field].toLowerCase().includes(searchString);
//     });
//     return results;
//   },
//   readDb:function() {
//     let methodName = "readDb";
//     console.log(this.myName + ": " + methodName + ": Attempting read of stored users data...");
//     fs.readFile(app.locals.usersDbFile,'utf8',function(err,data) {
//       if(err) throw err;
//       this.db = JSON.parse(data);
//       // console.log(JSON.stringify(this.db));
//       return true;
//     }.bind(this));
//     return;
//   },
//   writeDb:function() {
//     let methodName = "writeDb";
//     console.log(this.myName + ": " + methodName + ": Attempting write of in-memory user data...");
//     fs.writeFile(app.locals.usersDbFile,JSON.stringify(this.db),function(err) {
//       if(err) {
//         console.log(this.myName + ": " + methodName + ": Seems there was an error!");
//         throw err;
//       }
//       console.log(this.myName + ": " + methodName + ": Write success!");
//     }.bind(this));
//     return;
//   }
// };


let cases, users, parts;
let transporter = nodemailer.createTransport({
  host: app.locals.smtpServer,
  port: app.locals.smtpPort,
  secure: app.locals.smtpSecurity,
  ignoreTLS: true
});

transporter.verify(function(err,success) {
  if(err) {
    console.log(err); 
  }
  console.log('Server is ready... I think.');
});

let getDbs = function() {
  
  
}

let getUserDb = function(cb) {
  fs.readFile(app.locals.usersDbFile,'utf8',function(err,data) {
    if(err) throw err;
    users = data;
    cb();
  });  
}

let getPartsDb = function(cb) {
  fs.readFile(app.locals.partsDbFile,'utf8',function(err,data) {
    if(err) throw err;
    parts = data;
  });  
}

let getCasesDb = function(cb) {
  fs.readFile(app.locals.casesDbFile,'utf8',function(err,data) {
    if(err) throw err;
    cases = data;
  });
}

console.log("=====");


let mailOptions = {
  from: app.locals.smtpFromName + "<" + app.locals.smtpFromAddr + ">",
  to: 'travis@dataimpressions.com',
  subject: 'This is a test',
  text: 'Hi! This is a test!',
  html: '<h1>Hi!</h1><div>This is a test!</div>'
};

// transporter.sendMail(mailOptions, function(err,info) {
//   if(err) return console.log(err);
//   console.log('Message sent: %s', info.messageId);
// });

let sendUserUpdate = function(userName) {
  let myCases = cases.find("owner",userName).sort(function(a,b) {
    if(a.time<b.time) return -1;
    if(a.time>b.time) return 1;
    return 0;
  });
  // Get the cases that actualy have parts connected to them
  myCases = myCases.filter(function(caseRecord) {
    return (parts.findByCase(caseRecord.id).length>0);
  });
  console.log(JSON.stringify(myCases));
}

// sendUserUpdate("travis");

// let sendAdminUpdate = function() {

// }