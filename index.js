const express = require('express');
const app = express();
const session = require('express-session');
const pool = require("./db");
const bcrypt = require('bcrypt');
const path = require('path');
const flash = require('connect-flash');
const nodemailer = require("nodemailer");
module.exports = nodemailer;


app.use(express.urlencoded({extended:true}));
app.use(session({secret:'thisisnotasecret'}));
app.use(express.static("public"));
app.set('view engine','ejs');
app.set('views',path.join(__dirname,'views'));
app.use(flash());
app.use(function(req, res, next) {
    res.locals.user = req.session;
    res.locals.messages = req.flash('success');
    res.locals.errormsg = req.flash('error');
    res.locals.passerror = req.flash('passerror');
    res.locals.emailerror = req.flash('emailerror');
    res.locals.timeout = req.flash('timeout');
    res.locals.update = req.flash('update');
    res.locals.right = req.flash('right');
    next();
});

let transport = nodemailer.createTransport({
    host:"smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: 'viveknegi177@gmail.com',
      pass: 'iqvfydqvehapbqcn'
    }
 });

    let d = new Date();
    let minutes;

//function to hash the password !
const hashPassword = async (password, saltRounds = 10) => {
    try {
        // Generate a salt
        const salt = await bcrypt.genSalt(saltRounds);
        console.log(salt);

        // Hash password
        return await bcrypt.hash(password, salt);
    } catch (error) {
        console.log(error);
    }

    // Return null if error
    return null;
};

//function to compare hashed password from the database to the user entered password !
const comparePassword = async (password, hash) => {
    try {
        // Compare password
        return await bcrypt.compare(password, hash);
    } catch (error) {
        console.log(error);
    }

    // Return false if error
    return false;
};

//mail get route
app.get('/mail',(req,res) =>{ 
    res.render('mail.ejs');
})

//mail post route

app.post('/mail',async(req,res)=>{
    const rand = Math.floor((Math.random()*1000)+100);
    req.session.randi = rand;
    req.session.email = req.body.uname;

    const result = await pool.query('select * from student where email = $1',[req.body.uname]);

    if(!result.rows[0]){

        req.flash('emailerror','Your Email is not registerd with us');
        res.redirect('/mail');
    }
    else{

        const mailOptions = {
            from: 'viveknegi177@gmail.com', // Sender address
            to: req.body.uname, // List of recipients
            subject: 'Node Mailer', // Subject line
            text: `your otp valid for 2 minutes is ${rand}`, // Plain text body
        };
        await transport.sendMail(mailOptions, (err, info) =>{
            if (err) {
            console.log(err)
            } else {
            console.log(info);
            }
        });
            minutes = d.getMinutes();
            console.log(minutes);
            res.render('otp.ejs');
    }
    
})

//otp get route
app.get('/otp',(req,res) =>{
    res.render('otp.ejs');
})

//ot post route
app.post('/otp',async(req,res) =>{

        if(req.body.otp == req.session.randi)
        {
            res.render('newpass.ejs');
        }
        else
        {
            req.flash('error','Your otp is wrong!!!');
            res.redirect('/otp');
        }
})
app.post('/pass',async(req,res)=>{
    const hash = await hashPassword(req.body.npass);
    await  pool.query('update  student set password = $1 where email = $2',[hash,req.session.email]);
    res.redirect('/login');
})

//profile visit page
app.get('/profile',(req,res) =>{
    if(req.session.count == 0)
    {
        res.redirect('/home');
    }
    else
        res.render('login.ejs',{user:req.session.users});
})
//default route !
app.get('/',(req,res) =>{
    req.session.count= 0;
    res.render('home.ejs');
})

//get route to render home page to the screen !
app.get('/home',(req,res) =>{
    res.render('home.ejs');
})

//get route to render login form to the screen !
app.get('/login',async(req,res) =>{
    if(req.session.count!=0)
    {
        res.redirect('/home');
    } 
    else{
        res.render('loginform.ejs');
    }
})

app.get('/loginspecial',async(req,res) =>{
    res.render('loginform.ejs');
})

//post route to add a user to the session !
app.post('/login',async(req,res) =>{
    const uname = req.body.uname;
    const psw = req.body.psw;
    const status = await pool.query('select * from student where email= $1',[uname]);
    if(!status.rows[0])
    {
        console.log("Error!!!!!");
        res.render('home.ejs');
    }
    else if(status.rows[0].email == uname && await comparePassword(psw, status.rows[0].password)){
        req.session.users = status.rows[0];
        req.session.count = 1;
        res.render('login.ejs',{user:req.session.users});
    }
    else
    {
        req.flash('passerror','Your email or password is wrong !!please try again !!');
        res.redirect('/loginspecial');
    }

})

//get route to remove a user from the session !
app.get('/logout',(req,res) =>{
    req.session.count = 0;
    delete(req.session.users);
    res.redirect('/home');
})

//get route to render sign up page to the screen !
app.get('/sign',(req,res) =>{
    res.render('sign.ejs');
})

//post route to store username and password into the database!
app.post('/sign',async(req,res) =>{
    const name = req.body.name;
    const university = req.body.unv;
    const username = req.body.uname;
    const password = req.body.psw;

    const result = await pool.query('select * from student where email = $1',[username]);
    if(!result.rows[0]){
        const hash = await hashPassword(password);
        try{
        await pool.query('insert into student values ($1,$2,$3,$4)',[name,university,username,hash]);
        req.flash('success','You have been successfully registered!!!');
        res.redirect('/login');
        }catch(error)
        {
            console.log(error);
        }
    } else{
        req.flash('exist','Email already exists :');
        res.redirect('/sign');
    }
})

//edit get route 
app.get('/edit',(req,res) =>{
    res.render('edit.ejs');
})

//to edit the data of the user
app.post('/edit',async(req,res) => {
    const username = req.session.users.email;
    const pass = req.session.users.password ;
    
    const psw = req.body.pass;

    if(await comparePassword(psw, pass)){
        console.log(req.session.users);
        res.render('update.ejs',{user : req.session.users});
    }
    else{
        req.flash('right',"you have not entered the right password !");
        res.redirect('/edit');
    }

})

//to update the data of the user !
app.post('/update',async(req,res) => {
    const unv = req.body.unv;
    const uname = req.body.uname;
    const psw = req.body.psw;


    const hash = await hashPassword(psw);

    await pool.query('update student set email = $1 where email = $2',[uname,req.session.users.email]);
    await pool.query('update student set university = $1 where email = $2',[unv,req.session.users.email]);
    await pool.query('update student set password = $1 where email = $2',[hash,req.session.users.email]);

    const status = await pool.query('select * from student where email = $1',[uname]);
    req.session.users = status.rows[0];

    req.flash('update','updated successfully');
    res.redirect('/profile');

})


let port = 4000;
//initiating a port .
app.listen(port,() => {
    console.log(`listening on  port ${port}`);
})