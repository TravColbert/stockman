const nodemailer = require('nodemailer');
const fs = require('fs');
let app = {};
app.locals = JSON.parse(fs.readFileSync('config.json'));
app.locals.url = "https://" + app.locals.addr;
if(app.locals.port!="443") app.locals.url += ":" + app.locals.port;

console.log(app.locals);

let cases, users, parts;
let casesReady=false, 
    usersReady=false, 
    partsReady=false;

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

let getDbs = function(cb) {
  fs.readFile(app.locals.usersDbFile,'utf8',function(err,data) {
    if(err) throw err;
    users = JSON.parse(data);
    usersReady = true;
    if(casesReady && usersReady && partsReady) cb();
  });  
  fs.readFile(app.locals.partsDbFile,'utf8',function(err,data) {
    if(err) throw err;
    parts = JSON.parse(data);
    partsReady = true;
    if(casesReady && usersReady && partsReady) cb();
  });  
  fs.readFile(app.locals.casesDbFile,'utf8',function(err,data) {
    if(err) throw err;
    cases = JSON.parse(data);
    casesReady = true;
    if(casesReady && usersReady && partsReady) cb();
  });
}

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

let listDbs = function() {
  console.log(users);
}

let getUsersWithOpenCases = function() {
  console.log("we're all ready to go!");
  let openCases = getCasesWithParts(parts,cases);
  console.log("Cases with parts: " + openCases);
  let userList = [];
  for(let c=0;c<users.length;c++) {
    console.log("User: " + c + " : " + users[c].username);
    let myCases = getCasesByUsername(users[c].username,openCases);
    console.log("Open cases owned by " + users[c].username + " : " + myCases);
    if(myCases.length>0) {
      userList.push({
        id:users[c].id,
        username:users[c].username,
        email:users[c].email || null,
        cases:myCases
      });
    }
  }
  return userList;
}

let getCasesWithParts = function(partsList,caseList) {
  let casesWithParts = [];
  partsList.map(function(partRecord) {
    casesWithParts = casesWithParts.concat(partRecord.cases).sort();
  });
  console.log(casesWithParts);
  let casesWithPartsUniq = [];
  casesWithPartsUniq = casesWithParts.reduce(function(collection,item){
    if(collection.indexOf(item)<0) collection.push(item);
    return collection;
  },[]);
  console.log(casesWithPartsUniq);
  let caseListReduced = [];
  casesWithPartsUniq.forEach(function(v) {
    caseListReduced.push(caseList.find(function(caseRecord){
      return caseRecord.id==v;
    }));
  });
  return caseListReduced;
}

let getCasesByUsername = function(username,caseList) {
  let usersCases = caseList.filter(function(v) {
    return v.owner==username;
  });
  return usersCases;
}

let emailUsersWithOpenCases = function(userList) {
  userList.forEach(function(v,i) {
    let personName = v.username[0].toUpperCase() + v.username.slice(1);
    let html = `<p>Hi ${personName},`;
    html += `<p>This is just reminder that you have ${v.cases.length} ${(v.cases.length>1) ? "cases" : "case"} with parts still checked out.`;
    html += `<ul>`;
    for(let c=0;c<v.cases.length;c++) {
      let dateTime = new Date(v.cases[c].time).toLocaleDateString() + " " + new Date(v.cases[c].time).toLocaleTimeString();
      let ageMs = Date.now()-parseInt(v.cases[c].time);
      let ageDays = Math.round((ageMs/(1000*60*60*24)));
      html += `<li><a href="${app.locals.addr}:${app.locals.port}/case/${v.cases[c].id}">${v.cases[c].id}</a>. This case is ${ageDays} ${(ageDays==1) ? "day" : "days"} old. Last edited on ${dateTime}.</li>`
    }
    html += `</ul>`;
    html += `<p style="font-size:0.8em">Click on the links to see the details for each case.`;
    html += `<p>Keep track of them all in <a href="${app.locals.addr}:${app.locals.port}/user/${v.id}">${app.locals.appName}</a>.`;
    html += `<p>Sincerely,`;
    html += `<p style="margin-left:0.5em">stockr`;
    let mailOptions = {
      from: app.locals.smtpFromName + "<" + app.locals.smtpFromAddr + ">",
      to: v.email,
      subject: 'Cases with checked-out parts in your name',
      html: html
    };
    transporter.sendMail(mailOptions, function(err,info) {
      if(err) return console.log(err);
      console.log("Message send to " + v.username);
    });
  })
}

console.log("=====");

getDbs(function(){
  listDbs();
  let usersWithOpenCases = getUsersWithOpenCases();
  emailUsersWithOpenCases(usersWithOpenCases);
});  
