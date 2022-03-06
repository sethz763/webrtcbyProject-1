const status_label = document.getElementById('register_status');
const email = document.getElementById('email');
const username = document.getElementById('username');
const password = document.getElementById('password');
const reenterPassword = document.getElementById('reenterPassword');
const submit_button = document.getElementById('submit_button');
const form = document.getElementById('myform');

status_label.innerHTML = 'ENTER ALL FIELDS';

username.addEventListener("input", function(){
    if(username.value.length > 1){
        status_label.innerHTML = "Username Entered now enter password"
    }
    else{
        status_label.innerHTML = "Enter Username"
    }
});

password.addEventListener("input", function(){
    if(password.value.length < 1){
        status_label.innerHTML = 'Enter a Password';
    }
    else if(reenterPassword.value == ''){
        status_label.innerHTML = 'Reenter your password';
    }
});

reenterPassword.addEventListener("input", function(){
    if(reenterPassword.value === ''){
        status_label.innerHTML= 'Reenter your password';
    }
    else if(password.value != reenterPassword.value){
        status_label.innerHTML = 'Passwords do not match';
    }
    else if(password.value === reenterPassword.value){
        status_label.innerHTML = 'Passwords Match';
    }
});

form.addEventListener('submit', function(event){
    console.log("validating...")
    if(validateEmail()
    && username.value.length > 1
    && password.value === reenterPassword.value){
        status_label.innerHTML = 'Seems okay';

}
else{
    status_label.innerHTML = 'Missing something in the form';
    event.preventDefault();
}
    
})

function validateEmail() {
    atpos = email.value.indexOf("@");
    dotpos = email.value.lastIndexOf(".");
    
    if (atpos < 1 || ( dotpos - atpos < 2 )) {
        status_label.innerHTML = "Please enter correct email ID"
        email.focus() ;
        return false;
    }
    return true ;
 }





