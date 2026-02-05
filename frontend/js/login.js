document.getElementById("loginBtn").onclick = () => {
  var username = document.getElementById('username').value;
  console.log("username is: " + username);
  if (!username || username.length > 12) {
    console.log('try another username please :)');
  } else {
    window.location.href = `/auth/google?username=${encodeURIComponent(username)}`;
  }
};