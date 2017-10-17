var testHash;
let bcrypt = dcodeIO.bcrypt;

function authCheck() {
  let ss = document.getElementById("secretsauce").value;
  let pw = document.getElementById("password").value;
  // window.alert(ss + " + " + pw);
  console.log("PW:" + pw);
  bcrypt.genSalt(10,function(err,salt) {
    console.log("Salt:" + salt);
    bcrypt.hash(pw,salt,function(err,hash) {
      console.log("Hash 1:" + hash);
      testHash = hash;
    });
  });
}

function authTest() {
  let pw = document.getElementById("password").value;
  let rounds = bcrypt.getRounds(testHash);
  console.log("Rounds of encryption:" + rounds);
  bcrypt.compare(pw,testHash,function(err,result) {
    if(err) {
      console.log("!! Some kind of error !!");
      return;
    }
    console.log("Result:" + result);
  });
}

function ready(fn) {
  if (document.readyState != 'loading'){
    fn();
  } else {
    document.addEventListener('DOMContentLoaded', fn);
  }
}

ready(function() {
  // window.alert("Hi there!");
});
