process.env.TZ = "Asia/Kolkata";
require('dotenv').config()
const AWS = require('aws-sdk')
const Razorpay = require("razorpay");
const voucher_codes = require('voucher-code-generator')
const bcrypt = require('bcrypt')
const express = require('express')
const mysql = require('mysql')
const cors = require('cors')
const date = require('date-and-time')
const orderid = require('order-id')('key')
const { nanoid } = require('nanoid')
const { v4: uuidv4 } = require('uuid');
const mongo = require('mongodb').MongoClient
const ObjectID = require('mongodb').ObjectID
const jwt = require('jsonwebtoken')
const fileUpload = require('express-fileupload');
const isAuthenticated = require('./authenticator/auth');
const isSamAuthenticated = require('./authenticator/samAuth');
const xl = require('excel4node');
const { resourceLimits } = require('worker_threads');
const { stat, link } = require('fs');
const { ObjectId } = require('mongodb');
const { AppConfig, AlexaForBusiness } = require('aws-sdk');
const { ASSESSMENTS, CONTACT_MESSAGES, MOCKTEST, SAMLIBRARY, USER_OPTION_RESPONSE, REPORT_LINKS, USER_ANSWERS, USERS, PAGE_SIZE, PLAN_COLOR, PLANS, TOPUPS, TRANSACTIONS, MONTHS, MOCKTEST_SHEETS, CONTACT_US } = require('./utils/constants');
const path = require('path')
const crypto = require('crypto');
const { isDataView } = require('util/types');
const { createSlots, findCurrentSlotAndDaysToEnd, getMyPremiumPlan, createSlotsFromDate, findSlotIndex } = require('./utils/util');
const app = express()
const server = require('http').Server(app)
const io = require('socket.io')(server)
const cred ={host: 'localhost', port: 3306, user: 'ratul', password: 'rd1092'}
app.use(express.static('public'))
app.use(express.urlencoded({extended: true}))
app.use(express.json())
app.use(fileUpload())
app.use(cors())
const saltRounds = 10;
const PORT = process.env.PORT
let students = []


server.listen(PORT, ()=>{
  console.log(`Server listening on port ${PORT}`)
})
mongo.connect(process.env.MONGO_URI, {useUnifiedTopology : true},(err, db)=>{
    if(err) throw err 
    const dbo=db.db("tykhere")
    console.log("Mongo DB connected Successfully")
    
    function logErrorReturn(origin, msg, res){
        dbo.collection("errorLog").insertOne({origin: origin, message: msg, date: new Date()})
        res.send({success: false, auth: true, message: msg, status: 401})
    }

    function logError(origin, msg){
        dbo.collection("errorLog").insertOne({origin: origin, message: msg, date: new Date()})
    }

    //===testing
    // dbo.collection(USER_ANSWERS).find({}).project({linkCode: 1}).toArray((err, result)=>{
    //     if(err)
    //         throw err
    //     result.map(rs=>{
    //         let linkCode = rs.linkCode
    //         dbo.collection(ASSESSMENTS).findOne({linkCode: linkCode}, (err, result1)=>{
    //             if(err)
    //                 throw err
    //             let createdOn = result1.createdOn
    //             dbo.collection(USER_ANSWERS).updateOne({linkCode: linkCode}, {$set: {createdOn: new Date(createdOn)}})
    //             console.log("done")
    //         })

    //     })
    // })
    //===end testing


    function auditLog(origin, msg, user=""){
        dbo.collection("auditLog").insertOne({origin: origin, user: user, message: msg, date: new Date()})
    }
    app.get('/', (req, res)=>{
        res.send("Tykhere here")
    })
    app.post('/trainer/login', (req, res)=>{
        let phone= req.body.phone;
        let password = req.body.password;
        dbo.collection("users").findOne({phone: phone, password: password},(err,result)=>{
            if(err){
                logErrorReturn( "trainer login", err.message, res)
            }else{
                if(result){
                    const user = result
                    const token = jwt.sign({ email: user.email, name: user.name, phone: user.phone}, process.env.JWT_SECRET, { expiresIn: '30d' })
                    auditLog('trainer login',  `a user ${user.name} with phone ${user.phone} logged In`)
                    res.send({success: true, message: {message: "Successfully Logged In", data: {name: user.name, phone: user.phone,  token: token}}, status: 200})
                }else{
                    auditLog( 'trainer login', `a user with phone ${phone} Entered Invalid credentials`)
                    res.send({success: false, message: "Invalid Credentials!", status: 200})
                }
            }
        })
    })
    app.post('/trainer/google-login', (req, res)=>{
        const {email} = req.body
        dbo.collection("users").findOne({email: email},(err,result)=>{
            if(err){
                logErrorReturn( "trainer login", err.message, res)
            }else{
                if(result){
                    const user = result
                    const token = jwt.sign({ email: user.email, name: user.name, phone: user.phone}, process.env.JWT_SECRET, { expiresIn: '30d' })
                    auditLog('trainer login',  `a user ${user.name} with phone ${user.phone} logged In`)
                    res.send({success: true, message: {message: "Successfully Logged In", data: {name: user.name, phone: user.phone,  token: token}}, status: 200})
                }else{
                    auditLog( 'trainer login', `a user with phone ${phone} Entered Invalid credentials`)
                    res.send({success: false, message: "We could not find account with that google account", status: 200})
                }
            }
        })
    })

 
    app.post('/trainer/request-otp', (req, res)=>{
        const {phone} = req.body
        const random = Math.floor(100000 + Math.random() * 900000)
        const YOUR_MESSAGE = `Your verification code for tykhere is ${random}`
        var params = {
          Message: YOUR_MESSAGE,
          PhoneNumber: phone,
          MessageAttributes: {
              'AWS.SNS.SMS.SMSType': {
                  'DataType': 'String',
                  'StringValue': "Transactional"
              }
          }
      };
  
      var publishTextPromise = new AWS.SNS({ apiVersion: '2010-03-31' }).publish(params).promise();
  
      publishTextPromise.then(
          function (data) {
              let message_id = data.MessageId
              const token = jwt.sign({phone: phone, otp: random}, process.env.JWT_SECRET, { expiresIn: 4*60 })
              res.send({success: true, message: {message: "OTP sent Successfully", message_id: message_id, token: token}, status: 200})
          }).catch(
              function (err) {
                res.send({success: false, message: JSON.stringify(err), status: 401})
          });
    })
    app.post('/trainer/verify-otp', (req, res)=>{
        const {otp, token} = req.body
        jwt.verify(token, process.env.JWT_SECRET, (err, decoded)=>{
          if(err){
            res.send({success: false, message: err.message, status: 401})
          }else{
            let actual_otp = decoded.otp
            let phone = decoded.phone
            if(actual_otp == otp){
                res.send({success: true, message: "OTP Verified Successfully", status: 200})
            }else{
              res.send({success: false, message: "Invalid OTP!", status: 200})
            }
          }
      })
    })
    app.post('/request-reset-link', (req, res)=>{
        let {phone} = req.body
        dbo.collection("users").findOne({phone: phone}, (err, result)=>{
            if(err)
                throw err
            if(result){
                let linkCode = uuidv4()
                const RESET_LINK = `https://tykhere.com/reset-password/${linkCode}`
                const YOUR_MESSAGE = `Your Password Reset Link for tykhere is ${RESET_LINK}`
                var params = {
                  Message: YOUR_MESSAGE,
                  PhoneNumber: phone,
                  MessageAttributes: {
                      'AWS.SNS.SMS.SMSType': {
                          'DataType': 'String',
                          'StringValue': "Transactional"
                      }
                  }
              };
          
              var publishTextPromise = new AWS.SNS({ apiVersion: '2010-03-31' }).publish(params).promise();
          
              publishTextPromise.then(
                  function (data) {
                      let message_id = data.MessageId
                      dbo.collection("resetLinks").insertOne({phone: phone, linkCode: linkCode, createdOn: new Date()}, (err,result)=>{
                            if(err)
                                throw err
                            res.send({success: true, message: "Link sent Successfully", status: 200})
                      })
                  }).catch(
                      function (err) {
                        res.send({success: false, message: JSON.stringify(err), status: 401})
                  });
            }else{
                res.send({success: false, message: "No account exists with the current phone number", status: 200})
            }
        })
    })
    app.post('/verify-reset-link', (req, res)=>{
        let {linkCode} = req.body
        dbo.collection("resetLinks").findOne({linkCode: linkCode}, (err, result)=>{
            if(err)
                throw err
            if(result){
                let createdOn = result.createdOn
                let ed = new Date(createdOn)
                let dn = new Date()
                let mins = (dn.getTime() - ed.getTime())/(1000*60)
                if(mins > 10){
                    res.send({success: false, message: "Link Expired!", status: 200})
                }else{
                    res.send({success: true, message: "Valid Link!", status: 200})
                }
            }else{
                res.send({success: false, message: "Invalid Link!", status: 200})
            }
        })
    })

    app.post('/reset-password', (req, res)=>{
        let {linkCode, password} = req.body
        dbo.collection("resetLinks").findOne({linkCode: linkCode}, (err, result)=>{
            if(err)
                throw err
            if(result){
                let createdOn = result.createdOn
                let ed = new Date(createdOn)
                let dn = new Date()
                let mins = (dn.getTime() - ed.getTime())/(1000*60)
                if(mins > 10){
                    res.send({success: false, message: "Link Expired!", status: 200})
                }else{

                    let phone = result.phone
                    dbo.collection("users").updateOne({phone: phone}, {$set: {password: password}}, (err, result)=>{
                        if(err)
                            throw err
                        res.send({success: true, message: "Updated successfully", status: 200})
                    })
                }
            }else{
                res.send({success: false, message: "Invalid Link!", status: 200})
            }
        })

    })

    app.post('/trainer/register', (req, res)=>{
        let name =  req.body.name
        let email = req.body.email
        let phone = req.body.phone
        let password = req.body.password
        let planO = {name: "Trial Plan", assessmentCount: 20, validity: 14, used: 0, color: PLAN_COLOR.TRIAL, createdOn: new Date()}
        const jsonObj={name: name, email: email, phone: phone, password: password, plan: planO,  createdOn: new Date()};
        dbo.collection("users").findOne({phone: phone}, (err,result)=>{
            if(err)
                throw err
            if(!result){
                dbo.collection("users").insertOne(jsonObj, (err,result2)=>{
                   if(err)
                        throw err
                    auditLog("trainer register", `a user ${name} with email id ${email} registered successfully`)
                    res.send({success: true, message: "Successfully registered", status: 200})
                })
            }else{
                auditLog("trainer register", `a user ${name} with email id ${email} tried to register but was already registered`)
                res.send({success: false, message: "User already exists", status: 200})
            }
        })
    })
    app.post('/trainer/check-user', isAuthenticated, (req, res)=>{
        let phone = req.phone
        dbo.collection("users").findOne({phone: phone}, (err, result)=>{
            if(err)
                logErrorReturn("Check user", err.message, res)
            else{
                if(result){
                    res.send({success: true, message: "OK", status: 200})
                }else{
                    res.send({success: false, message: "NO", status: 200})
                }
            }
        })
    })
    app.post('/trainer/current-plan', isAuthenticated, (req, res)=>{
        let phone = req.phone
        dbo.collection(USERS).findOne({phone: phone}, {projection: {plan: 1}}, (err, result)=>{
            // if(err){
            //     logErrorReturn("current plan", err.message, res)
            // }else{
            //     dbo.collection("assessments").countDocuments({phone: phone}, (err, count)=>{
            //         let newresult = {...result, remainingCount: count}
            //         res.send({success: true, message: newresult, status: 200})
            //     })
            // }
            if(err)
                throw err
            res.send({success: true, message: result, status: 200})
        })
    })
    app.post('/admin/add-plan', isSamAuthenticated, (req, res)=>{
        const {plan} = req.body
        plan.createdOn = new Date()
        plan.updatedOn = new Date()
        plan.count = parseInt(plan.count)
        plan.discount = parseInt(plan.discount)
        plan.price = parseInt(plan.price)
        plan.validity = parseInt(plan.validity)
        dbo.collection(PLANS).insertOne(plan, (err, result)=>{
            if(err) throw err
            res.send({success: true, message: "Added Successfully"})
        })  
    })
    app.post('/admin/update-plan', isSamAuthenticated, (req, res)=>{
        const {id, plan} = req.body
        plan.count = parseInt(plan.count)
        plan.discount = parseInt(plan.discount)
        plan.price = parseInt(plan.price)
        plan.validity = parseInt(plan.validity)
        dbo.collection(PLANS).updateOne({_id: ObjectId(id)}, {$set: {...plan, updatedOn: new Date()}}, (err, result)=>{
            if(err) throw err
            res.send({success: true, message: "Updated Successfully"})
        })
    })
    app.get('/admin/get-plans', isSamAuthenticated, (req, res)=>{
        dbo.collection(PLANS).find({}).sort({updatedOn: -1}).toArray((err, result)=>{
            if(err) throw err
            res.send({success: true, message: result})
        })
    })
    app.post('/admin/add-topup', isSamAuthenticated, (req, res)=>{
        const {plan} = req.body
        plan.createdOn = new Date()
        plan.updatedOn = new Date()
        dbo.collection(TOPUPS).insertOne(plan, (err, result)=>{
            if(err) throw err
            res.send({success: true, message: "Added Successfully"})
        })  
    })
    app.post('/admin/update-topup', isSamAuthenticated, (req, res)=>{
        const {id, plan} = req.body
        dbo.collection(TOPUPS).updateOne({_id: ObjectId(id)}, {$set: {...plan, updatedOn: new Date()}}, (err, result)=>{
            if(err) throw err
            res.send({success: true, message: "Updated Successfully"})
        })
    })
    app.get('/admin/get-topups', isSamAuthenticated, (req, res)=>{
        dbo.collection(TOPUPS).find({}).sort({updatedOn: -1}).toArray((err, result)=>{
            if(err) throw err
            res.send({success: true, message: result})
        })
    })
    app.get('/trainer/check-plan', isAuthenticated, (req,res)=>{
        let phone = req.phone
        dbo.collection(USERS).findOne({phone: phone}, {projection: {plan: 1}}, (err, result)=>{
            if(err)
                throw err
            res.send({success: true, message: result, status: 200})
        })
    })
    app.post('/trainer/create-assessment', isAuthenticated, (req, res)=>{
        let phone = req.phone
        let assessment = req.body
        assessment.phone = phone
        assessment.status = 'upcoming'
        assessment.code =  voucher_codes.generate({
            length: 6,
            count: 1,
            charset: "0123456789"
        });
        assessment.linkCode = uuidv4()
        //  let sd = new Date(assessment.startDate)
        //  let ed = new Date(assessment.endDate)
        // assessment.startDate = date.addHours(sd, 5.5)
        // assessment.endDate = date.addHours(ed, 5.5)
        assessment.createdOn = new Date()

        dbo.collection("assessments").insertOne(assessment, (err,result)=>{
            if(err)
                throw err
            auditLog("trainer save assessment", `a user with phone ${phone} created new assessment`)

            //update cound
            dbo.collection(USERS).findOne({phone: phone}, (err, result)=>{
                if(err) throw err
                let plan = result.plan
                if(plan.name === "Trial Plan"){
                    plan.assessmentCount = plan.assessmentCount - 1
                }else{
                    let slots = plan.slots
                    let index = findSlotIndex(slots)
                    let slot = slots[index]
                    slot.used = slot.used+1
                    slots[index] = slot
                    plan.slots = slots
                    dbo.collection(USERS).updateOne({phone: phone}, {$set: {plan: plan}})
                }
            })            
            res.send({success: true, auth: true, message: "Successfully Submitted Assessment", status: 200})

        })
    })
    app.post('/trainer/assessments', isAuthenticated, (req, res)=>{
        let phone = req.phone
        dbo.collection("assessments").find({phone: phone}, {projection: {title: 1, numQns: 1, numTopics: 1, duration: 1, flexible: 1, startDate: 1, endDate: 1, code: 1, linkCode: 1, createdOn: 1, status: 1, banner: 1}}).sort({createdOn: -1}).toArray((err,result)=>{
            if(err){
                logErrorReturn("trainer all assessments", err.message, res)
            }else{
                res.send({success: true, auth: true, data: result, status: 200})
            }
        })
    })
    app.post('/trainer/get-assessments', isAuthenticated, (req, res) => {
        let phone = req.phone;
        const { searchQ, cfilter, cmonth, cyear } = req.body;

        let cm = req.body.cmonth
        if(cm !== ''){
            cm =  parseInt(cm)+1;
        }
        
        let query = { phone: phone };
        if (searchQ !=='') {
            query.title = new RegExp(searchQ, 'i');  // This allows for case-insensitive search
        }
        if (cfilter !=='All') {
            query.status = cfilter.toLowerCase();
        }
        if (cyear !=='' && cm=='') {  // Only year is provided
            let startOfYear = new Date(cyear, 0, 1);
            let startOfNextYear = new Date(parseInt(cyear) + 1, 0, 1);
            query.createdOn = { $gte: startOfYear, $lt: startOfNextYear };
        }
        else if (cyear==='' && cm!=='') {  // Only month is provided
            query.createdOn = { $gte: new Date(1970, cm - 1, 1), $lt: new Date(1970, cm, 1) };
        }
        else if (cyear!=='' && cm!=='') {  // Both month and year are provided
            let startOfMonth = new Date(cyear, cm - 1, 1);
            let startOfNextMonth = new Date(cyear, cm, 1);
            query.createdOn = { $gte: startOfMonth, $lt: startOfNextMonth };
        }
    
        dbo.collection(ASSESSMENTS)
           .find(query, {
               projection: {
                   title: 1, numQns: 1, numTopics: 1, duration: 1, flexible: 1,
                   startDate: 1, endDate: 1, code: 1, linkCode: 1, createdOn: 1,
                   status: 1, banner: 1
               }
           })
           .sort({ createdOn: -1 })
           .toArray((err, result) => {
                if (err) {
                    logErrorReturn("trainer all assessments", err.message, res);
                } else {
                    res.send({ success: true, auth: true, data: result, status: 200 });
                }
           });
    });
    
    app.post('/trainer/todays-assessment', isAuthenticated, (req, res)=>{
        let phone = req.phone
        //flexible assessment
        dbo.collection("assessments").find({phone: phone, flexible: false, status: 'upcoming'}, {projection: {title: 1, numQns: 1, numTopics: 1, duration: 1, code: 1, linkCode: 1, date: 1, status: 1}}).sort({createdOn: -1}).limit(1).toArray((err, result)=>{
            if(err){
                logErrorReturn("trainer todays assessment", err.message, res)
            }else{
                if(result.length>0){
                    res.send({success: true, auth: true, message: result, status: 200})
                }else{
                    //const start = 
                    //start.setHours(0,0,0,0)
                    const start = date.addMinutes(new Date(), 10)
                    var end = new Date()
                    end.setHours(23,59,59,999)
                    dbo.collection("assessments").find({phone: phone, flexible: true, status: 'upcoming', scheduledDate: {$gt: start, $lt: end}}, {projection: {title: 1, numQns: 1, numTopics: 1, duration: 1, code: 1, linkCode: 1, date: 1, status: 1}}).sort({date: -1}).limit(1).toArray((err, result)=>{
                        if(err){
                            logErrorReturn("trainer todays assessment", err.message, res)
                        }else{
                            res.send({success: true, auth: true, message: result, status: 200})
                        }
                    })
                }
            }
        })
    })

    app.post('/trainer/assessment-details', isAuthenticated, (req, res)=>{
        let phone = req.phone
        let {linkCode} = req.body
        dbo.collection("assessments").findOne({phone: phone, linkCode: linkCode}, (err,result)=>{
            if(err)
                throw err;
           if(result){
               //let details = {title:result.title, duration: result.duration, numQns: result.numQns, numTopics: result.numTopics, code: result.code}
                res.send({success: true, auth: true, message: result, status: 200})
           }else{
                res.send({success: false, auth: true, message: "No Records found", status: 401})
           }
        })
    })
    app.post('/trainer/get-assessment', isAuthenticated, (req, res)=>{
        let phone = req.phone
        let {linkCode} = req.body
        dbo.collection("assessments").findOne({phone: phone, linkCode: linkCode}, (err,result)=>{
            if(err)
                throw err;
           if(result){
               //let details = {title:result.title, duration: result.duration, numQns: result.numQns, numTopics: result.numTopics, code: result.code}
                res.send({success: true, message: result, status: 200})
           }else{
                res.send({success: false, auth: true, message: "No Records found", status: 401})
           }
        })
    })
    app.post('/admin/get-trainers', isSamAuthenticated, (req, res)=>{
        const {page=1, searchQ} = req.body
        let skip = (parseInt(page)-1)*parseInt(30)
        let query = {}
        if(searchQ !== ""){
            query.name = {
                "$regex": searchQ,
                "$options": "i"
            }
        }
        dbo.collection(USERS).find(query).sort({updatedOn: -1}).skip(skip).limit(30).toArray((err, result)=>{
            if(err) throw err
            res.send({success: true, message: result, status: 200})
        })
    })
    app.post('/admin/trainers-overview', isSamAuthenticated, (req, res)=>{
        //Query by year
        //let phone = req.phone
        const {year} = req.body
        var startYear = new Date(year, 0, 1);
        var endYear = new Date(year, 11, 31);
        dbo.collection(USERS).aggregate([
            {$match: {date: {$gte: startYear, $lte: endYear}}},
            {$group: {
                _id: {$month: "$date"}, 
                numTrainers: {$sum: 1} 
            }}
        ]).toArray((err, result)=>{
            
            res.send({success: true, message: result, status: 200})
        })
    })
    app.post('/admin/mocktests-overview', isSamAuthenticated, (req, res)=>{
        //Query by year
        //let phone = req.phone
        const {year} = req.body
        var startYear = new Date(year, 0, 1);
        var endYear = new Date(year, 11, 31);
        dbo.collection(MOCKTEST).aggregate([
            {$match: {createdOn: {$gte: startYear, $lte: endYear}}},
            {$group: {
                _id: {$month: "$createdOn"}, 
                numMocktests: {$sum: 1} 
            }}
        ]).toArray((err, result)=>{
            res.send({success: true, message: result, status: 200})
        })
    })
    app.post('/trainer/assessment-overview', isAuthenticated, (req, res)=>{
        //Query by year
        let phone = req.phone
        const {year} = req.body
        var startYear = new Date(year, 0, 1);
        var endYear = new Date(year, 11, 31);
        dbo.collection(ASSESSMENTS).aggregate([
            {$match: {phone: phone, createdOn: {$gte: startYear, $lte: endYear}}},
            {$group: {
                _id: {$month: "$createdOn"}, 
                numAssessments: {$sum: 1} 
            }}
        ]).toArray((err, result)=>{
            res.send({success: true, message: result, status: 200})
        })
    })
    app.post('/trainer/headcounts-overview', isAuthenticated, (req, res)=>{
        //Query by year
        let phone = req.phone
        const {year} = req.body
        var startYear = new Date(year, 0, 1);
        var endYear = new Date(year, 11, 31);
        dbo.collection(USER_ANSWERS).aggregate([
            {$match: {answers: {$elemMatch: {phone: {$eq: phone}}}, createdOn: {$gte: startYear, $lte: endYear}}},
            {$group: {
                _id: {$month: "$createdOn"}, 
                count: {$sum: 1} 
            }}
        ]).toArray((err, result)=>{
            res.send({success: true, message: result, status: 200})
        })
    })
    app.get('/trainer/get-my-plan', isAuthenticated, (req, res)=>{
        let phone = req.phone
        dbo.collection(USERS).findOne({phone: phone}, (err, result)=>{
            if(err) throw err
            const now = new Date();
            let plan = result.plan;
            let regDate = new Date(result.date);  
            const oneDayInMilliseconds = 24 * 60 * 60 * 1000; 
            const daysDifference = (now - regDate) / oneDayInMilliseconds;
            if (daysDifference > 14) {
                //Trial Expired
                if(plan.name === "Trial Plan"){
                    //return  expired trial plan
                    plan.remainingDays = parseInt(daysDifference)
                    plan.balance = plan.assessmentCount - plan.used
                    plan.count = plan.assessmentCount
                    plan.status = "Expired by Date"
                    res.send({success: true, message: plan})
                }else{
                    let myPremiumPlan = getMyPremiumPlan(plan)
                    res.send({success: true, message: myPremiumPlan})
                }
               
            } else {
                if(plan.name === "Trial Plan"){
                    //return  current trial plan
                    plan.remainingDays = parseInt(daysDifference)
                    plan.balance = plan.assessmentCount - plan.used
                    plan.count = plan.assessmentCount
                    plan.status = "Active"
                    res.send({success: true, message: plan})
                }else{
                    //return current plan
                    let myPremiumPlan = getMyPremiumPlan(plan)
                    res.send({success: true, message: myPremiumPlan})

                }
            }
        })
    })
    app.get('/trainer/transaction-history', isAuthenticated, (req, res)=>{
        let phone = req.phone
        dbo.collection(TRANSACTIONS).find({phone: phone}).sort({createdOn: -1}).limit(10).toArray((err, result)=>{
            if(err) throw err
            res.send({success: true, message: result})
        })
    })
    
    
    app.post('/trainer/update-assessment-status', isAuthenticated, (req, res)=>{
        let {status, linkCode} = req.body
        dbo.collection("assessments").updateOne({linkCode: linkCode}, {$set: {status: status, startDate: new Date()}}, (err, result)=>{
            if(err)
                throw err
            else    
                res.send({success: true, message: "Updated Successfully", status: 200})
        })
    })
    app.post('/trainer/update-assessment-to-started', isAuthenticated, (req, res)=>{
        let {linkCode} = req.body
        dbo.collection("assessments").updateOne({linkCode: linkCode}, {$set: {status: "started", startDate: new Date()}}, (err, result)=>{
            if(err)
                throw err
            else    
                res.send({success: true, message: "Updated Successfully", status: 200})
        })
    })
    app.post('/trainer/update-assessment-to-completed', isAuthenticated, (req, res)=>{
        let {linkCode} = req.body
        dbo.collection("assessments").updateOne({linkCode: linkCode}, {$set: {status: "completed"}}, (err, result)=>{
            if(err)
                throw err
            else{
                dbo.collection(USER_ANSWERS).updateOne({linkCode: linkCode}, {$set: {status: "completed"}}, (err, result)=>{
                    if(err)
                        throw err
                    res.send({success: true, message: "Updated Successfully", status: 200})
                })
            }    
        })
    })

    app.post('/get-assessment', (req, res)=>{
        let {linkCode} = req.body
        dbo.collection("assessments").findOne({linkCode: linkCode}, (err,result)=>{
            if(err)
                throw err;
           if(result){
                res.send({success: true,  message: result, status: 200})
           }else{
                res.send({success: false,  message: "No Records found", status: 401})
           }
        })
    })
    app.post('/assessment-details', (req, res)=>{
        let {linkCode} = req.body
        dbo.collection("assessments").findOne({linkCode: linkCode}, {projection: {questions: 0}}, (err,result)=>{
            if(err)
                throw err;
           if(result){
                //let details = {title: result.title, duration: result.duration, numQns: result.numQns, linkCode: result.linkCode, numTopics: result.numTopics, status: result.status, code: result.code}
                res.send({success: true,  message: result, status: 200})
           }else{
                res.send({success: false,  message: "No Records found", status: 401})
           }
        })
    })
    app.post('/student/get-assessment', (req, res)=>{
        let {linkCode} = req.body
        dbo.collection("assessments").findOne({linkCode: linkCode}, (err,result)=>{
            if(err)
                throw err;
           if(result){
                //let details = {title: result.title, duration: result.duration, numQns: result.numQns, linkCode: result.linkCode, numTopics: result.numTopics, status: result.status, code: result.code}
                res.send({success: true,  message: result, status: 200})
           }else{
                res.send({success: false,  message: "No Records found", status: 401})
           }
        })
    })

    // app.get('/test-script', (req, res)=>{
    //    dbo.collection(USERS).find({}).toArray((err, result)=>{
    //         if(err) throw err
    //         result.map(pl=>{
    //             let plan = pl.plan
    //             if(plan.name !=="Trial Plan"){
    //                 plan.slots = createSlotsFromDate(plan.assessmentCount, new Date(plan.createdOn))
    //                 dbo.collection(USERS).updateOne({phone: pl.phone}, {$set: {plan: plan}})  
    //             }              
    //         })
    //         res.send("result")
    //    })
    // })

    app.post('/user/save-answers', (req, res)=>{
        let ma = req.body
        let linkCode = ma.linkCode
        let name  = ma.name
        dbo.collection("userAnswers").findOne({name: name, linkCode: linkCode}, (err, result)=>{
            if(err)
                throw err
            if(result){
                // dbo.collection("userAnswers").updateOne({name: name, linkCode: linkCode}, {$set: {answers: ma.answers}}, (err,result)=>{
                //     if(err)
                //         throw err;
                //     //dbo.collection("assessments").updateOne({linkCode}, {$set:{status: 'completed'}})
                //     res.send({success: true, auth: true, message: "Successfully Submitted Aanswers", status: 200})
                // })
                res.send({success: true, auth: true, message: "You had already submitted answers", status: 200})
            }else{
                dbo.collection("userAnswers").insertOne({...ma, createdOn: new Date()}, (err,result)=>{
                    if(err)
                        throw err;
                    //dbo.collection("assessments").updateOne({linkCode}, {$set:{status: 'completed'}})
                    res.send({success: true, auth: true, message: "Successfully Submitted Aanswers", status: 200})
                })
            }
        })
    })

    app.post('/user/send-message', (req, res)=>{
        let body = req.body
        dbo.collection(CONTACT_MESSAGES).insertOne({...body, createdOn: new Date()}, (err, result)=>{
            if(err)
                throw err
            res.send({success: true, message: "Thank you for contacting US! We will get back to you soon.", status: 200})
        })
    })
    app.post('/user/get-completed-students', (req, res)=>{
        let {linkCode} = req.body
        dbo.collection("userAnswers").find({linkCode: linkCode}, {projection: {name: 1, score: 1, numAttempted: 1}}).toArray((err, result)=>{
            if(err)
                throw err
            res.send({success: true, message: result, status: 200})
        })
    })
    app.post('/user/check-candidate-name', (req, res)=>{
        let {name, linkCode} = req.body  
        dbo.collection("candidateName").findOne({name: {$regex: name}, linkCode: linkCode}, (err, result)=>{
            if(err)
                throw err
            console.log(result);
            if(result){
                res.send({success: false, message: "Name already in  use", status: 200})
            }else{
                dbo.collection("candidateName").insertOne({name: name, linkCode: linkCode}, (err, result)=>{
                    if(err)
                        throw err
                    res.send({success: true, message: "Name Submitted Successfully", status: false})
                })
            }
        })
    })
    app.post('/user/option-response', (req, res)=>{ 
        const toSave = req.body
        const collection = USER_OPTION_RESPONSE
        dbo.collection("userAnswers").findOne({linkCode: toSave.linkCode, name: toSave.name}, (err, result)=>{
            if(result){
                res.send({success: false, message: "Already completed"})
            }else{
                dbo.collection(collection).findOne({linkCode: toSave.linkCode, name: toSave.name, question_id: toSave.question_id}, (err,result)=>{
                    if(err){
                        logErrorReturn("User Option Response", err.message, res)
                    }else{
                        if(!result){
                            dbo.collection(collection).insertOne(toSave, (err,result2)=>{
                                if(err){
                                    logErrorReturn("User Option Response", err.message, res)
                                }else{
                                    res.send({success: true, message: "Response saved", status: 200})
                                }   
                            })
                        }else{
                            dbo.collection(collection).updateOne({linkCode: toSave.linkCode, name: toSave.name, question_id: toSave.question_id},  {$set: toSave}, (err, result)=>{
                                if(err){
                                    logErrorReturn("User Option Response", err.message, res)
                                }else{
                                    res.send({success: true, message: "Response updated", status: 200})
                                }  
                            })
                        }
                    }
                })
            }
        })
    })
    app.post('/user/get-option-response', (req, res)=>{
        let {linkCode} = req.body 
        dbo.collection(USER_OPTION_RESPONSE).aggregate([{$match: {linkCode: linkCode}}, {$group: {_id: "$name", count: {$sum: 1}, totalCorrect: {$sum: "$choiceCorrect"}}}]).toArray((err, result)=>{
            if(err)
                logErrorReturn("Get Option Response", err.message, res)
            else{
                res.send({success: true, message: result, status: 200})
            }
        })
    })
    app.post('/user/get-assessment-link', (req, res)=>{
        let {code} = req.body
        dbo.collection("assessments").findOne({code: code}, (err, result)=>{
            if(err)
                logErrorReturn("User Get assessment link", err.message, res)
            else{
                if(result){
                    let linkCode = result.linkCode
                    res.send({success: true, message: {linkCode: linkCode}, status: 200})
                }else{
                    res.send({success: false, message: "Invalid Code!", status: 200})
                }
            }
        })
    })
    app.get('/user/get-categories-all', (req, res)=>{
        dbo.collection("samCategories").find({status: 'Active'}).sort({createdOn: -1}).toArray((err, result)=>{
            if(err)
                logErrorReturn("User get Categories", err.message, res)
            else res.send({success: true, message: result, status: 200})
        })
    })
    app.post('/trainer/option-response-q-summary', (req, res)=>{
        const {linkCode} = req.body
        dbo.collection(USER_OPTION_RESPONSE).aggregate([{$match: {linkCode: linkCode}}, {$group: {_id: "$question_id", count: {$sum: 1}, totalCorrect: {$sum: "$choiceCorrect"}}}]).toArray((err, result)=>{
            if(err)
                logErrorReturn("Get Option Response", err.message, res)
            else{
                res.send({success: true, message: result, status: 200})
            }
        })
    })
    app.post('/trainer/option-response-topic-summary', (req, res)=>{
        const {linkCode} = req.body
        dbo.collection(USER_OPTION_RESPONSE).aggregate([{$match: {linkCode: linkCode}}, {$group: {_id: "$topic", count: {$sum: 1}, totalCorrect: {$sum: "$choiceCorrect"}}}]).toArray((err, result)=>{
            if(err)
                logErrorReturn("Get Option Response", err.message, res)
            else{
                res.send({success: true, message: result, status: 200})
            }
        })
    })
    app.post('/trainer/option-response-performance-summary', (req, res)=>{
        const {linkCode} = req.body
        dbo.collection(USER_OPTION_RESPONSE).find({linkCode}).toArray((err, result)=>{
            if(err)
                logErrorReturn("Get Option Response", err.message, res)
            else{
                res.send({success: true, message: result, status: 200})
            }
        })
    })
    app.get('/trainer/generate-report/:linkCode', (req, res)=>{
        const {linkCode} = req.params
        dbo.collection(REPORT_LINKS).findOne({linkCode: linkCode}, (err, result)=>{
            if(err)
                throw err
            if(result){
                //file already exists
                let filename = result.filename
                let filePath = __dirname+'/public/docs/'+filename
                res.download(filePath, err=>{
                    if(err)
                        throw err
                })
            }else{
                //create the file and download
                // Create a new instance of a Workbook class

                dbo.collection(ASSESSMENTS).findOne({linkCode: linkCode}, {projection: {numQns: 1}}, (err, result)=>{
                    if(err)
                        throw err
                    if(result){
                        const numQns = result.numQns

                        dbo.collection(USER_OPTION_RESPONSE).aggregate([{$match: {linkCode: linkCode}}, {$group: {_id: "$name", count: {$sum: 1}, totalCorrect: {$sum: "$choiceCorrect"}}}]).toArray((err, result)=>{
                            if(err)
                                throw err
                            let cL = result
                            cL.map(r=>{
                                r.unattempted = parseInt(numQns) - parseInt(r.count)
                                r.totalWrong = parseInt(r.count) - parseInt(r.totalCorrect)
                            })

                            const wb = new xl.Workbook()
                            const cs = wb.addWorksheet('Candidate Summary')
                            const ps = wb.addWorksheet('Performance Summary')
                            const headStyle = wb.createStyle({
                                font: {
                                  color: '#0a3069',
                                  size: 16,
                                }
                              });
                            const bodyStyle = wb.createStyle({
                                font: {
                                    color: '#27364d',
                                    size: 14
                                }
                            })
                            cs.cell(1,1).string('SI No').style(headStyle)
                            cs.cell(1,2).string('Participant Name').style(headStyle)
                            cs.cell(1,3).string('Correct answered').style(headStyle)
                            cs.cell(1,4).string('Wrong answered').style(headStyle)
                            cs.cell(1,5).string('Unattempted').style(headStyle)
                            cs.cell(1,6).string('Percentage').style(headStyle)

                            cL.map((c, i)=>{
                                cs.cell(i+2, 1).number(i+1).style(bodyStyle)
                                cs.cell(i+2, 2).string(c._id).style(bodyStyle)
                                cs.cell(i+2, 3).number(c.totalCorrect).style(bodyStyle)
                                cs.cell(i+2, 4).number(c.totalWrong).style(bodyStyle)
                                cs.cell(i+2, 5).number(c.unattempted).style(bodyStyle)
                                cs.cell(i+2, 6).number(Math.round((((c.totalCorrect/numQns)*100))*100)/100).style(bodyStyle)
                            })
                            let filename = "doc"+Date.now()+nanoid(10)+'.xlsx'
                            let filePath = __dirname+'/public/docs/'+filename
                            wb.write(filePath, (err, stats)=>{
                                if(err)
                                    console.log(err)
                                else{
                                    dbo.collection(REPORT_LINKS).insertOne({linkCode: linkCode, filename: filename, createdOn: new Date(), updatedOn: new Date()}, (err, result)=>{
                                        if(err)
                                            throw err
                                        res.download(filePath, err=>{
                                            if(err)
                                                throw err
                                        })
                                    })
                                }
                                
                            })

                        })
                    }
                })
            }
        })
    })

    app.post('/assessment-result', (req, res)=>{
        let {linkCode, name} = req.body
        dbo.collection(USER_ANSWERS).findOne({linkCode: linkCode, name: name}, (err,result1)=>{
            if(err)
                throw err
                if(result1){

                    dbo.collection("assessments").findOne({linkCode: linkCode}, (err, result)=>{
                        if(err) throw err
                        let myresult = result1
                        myresult.status = result.status
                        res.send({success: true,  message: myresult, status: 200})
                    })
                }else{
                    res.send({success: false,  message: "No answer sheet", status: 401})
                }

        })
    })

    app.post('/create-rzp-order', isAuthenticated, async(req, res)=>{
        const {amount, currency, receipt, assessmentCount, plan} = req.body
        try {
            const instance = new Razorpay({
              key_id: process.env.RAZORPAY_KEY_ID, // YOUR RAZORPAY KEY
              key_secret: process.env.RAZORPAY_SECRET, // YOUR RAZORPAY SECRET
            })
            const options = {
              amount: parseInt(amount)*100,
              currency: currency,
              receipt: receipt,
            }
            const order = await instance.orders.create(options);
            if (!order) return res.status(500).send('Some error occured');
            res.json(order);
        } catch (error) {
            res.status(500).send(error);
        }
    })
    app.post('/rzp-order-confirmation', (req, res)=>{
        let rb = req.body
        console.log(rb)
        res.send("Success")
    })
    app.post('/payment-success', isAuthenticated, async (req, res) => {
        let phone = req.phone
        try {
          const {
            orderCreationId,
            razorpayPaymentId,
            razorpayOrderId,
            razorpaySignature,
            planName, 
            assessmentCount,
            topUp = false
          } = req.body

          const shasum = crypto.createHmac('sha256', `${process.env.RAZORPAY_SECRET}`);
          shasum.update(`${orderCreationId}|${razorpayPaymentId}`);
          const digest = shasum.digest('hex');
      

          if (digest !== razorpaySignature)
            return res.status(400).json({success: false, message: 'Transaction not legit!' });
        
        dbo.collection(USERS).findOne({phone: phone}, (err, result)=>{
            if(err) throw err
            let name = result.name
            const planO = {
                phone: phone,
                name: name,
                order_creation_id:  orderCreationId,
                razorpay_payment_id: razorpayPaymentId,
                razorpay_order_id: razorpayOrderId,
                plan_name: topUp? `Topup${assessmentCount}`:planName,
                slots: createSlots(assessmentCount),
                createdOn: new Date()
            }
            dbo.collection(TRANSACTIONS).insertOne(planO, (err, result)=>{
                if(err) throw err
                if(topUp){
                    dbo.collection(USERS).updateOne({phone: phone}, {$inc: {"plan.topup": parseInt(assessmentCount)}});
                }else{
                    dbo.collection(USERS).updateOne({phone: phone}, {$set: {"plan.name": planName,   "plan.assessmentCount": parseInt(assessmentCount), "plan.validity": 30, "plan.slots": createSlots(parseInt(assessmentCount)), "plan.createdOn": new Date()}})
                }
                res.json({
                    success: true,
                    message: 'success',
                    orderId: razorpayOrderId,
                    paymentId: razorpayPaymentId,
                });
            })
        })          
        } catch (error) {
            throw error
          //res.status(500).send({success: false, message: error});
        }
    });
    
    app.get('/trainer/get-trainer-profile', isAuthenticated, (req, res)=>{
        let phone = req.phone
        dbo.collection(USERS).findOne({phone: phone}, (err, result)=>{
            if(err)
                throw err
            res.send({success: true, message: result, status: 200})
        })
    })
    app.post('/trainer/add-qn-lib-man', isAuthenticated, (req, res)=>{
        let phone = req.phone
        let question = req.body
        question.phone = phone
        question.status = "Active"
        question.createdOn = new Date()
        question.updatedOn = new Date()
        dbo.collection("library").insertOne(question, (err, result)=>{
            if(err){
                logErrorReturn("trainer add question to library manually", err.message, res)
            }else{
                dbo.collection("trainerTopics").updateOne({phone: phone, topic: question.topic}, {$inc: {numQns: 1}})
                res.send({success: true, auth: true, message: {message: "Added Successfully", id: result.insertedId}, status: 200})    
            }
        })
    })

    app.get('/get-subscription-plans', (req, res)=>{
        dbo.collection(PLANS).find({isActive: true}).sort({price: 1}).toArray((err, result)=>{
            if(err) throw err
            res.send({success: true, message: result})
        })
    })
    app.get('/get-topup-plans', (req, res)=>{
        dbo.collection(TOPUPS).find({isActive: true}).sort({sort: 1}).toArray((err, result)=>{
            if(err) throw err
            res.send({success: true, message: result})
        })
    })
    app.post('/trainer/delete-qn-lib', isAuthenticated, (req, res)=>{
        let phone = req.phone
        let {qid, topic} = req.body
        dbo.collection("library").deleteOne({_id: ObjectId(qid)}, (err, result)=>{
            if(err){
                logErrorReturn("delete question from library", err.message, res)
            }else{
                dbo.collection("trainerTopics").updateOne({phone: phone, topic: topic}, {$inc: {numQns: -1}})
                res.send({success: true, auth: true, message: "Deleted Successfully", status: 200})    
            }
        })
    })

    app.post('/trainer/add-question-group', isAuthenticated, (req, res)=>{
        let {questions} = req.body
        dbo.collection("library").insertMany(questions, (err, result)=>{
            if(err){
                logErrorReturn("add-question-group", err.message, res)
            }else{
                res.send({success: true, auth: true, message: "Added Successfully", status: 200})
            }
        })
    })
    app.post('/trainer/get-duplicate-questions', isAuthenticated, (req, res)=>{
        let phone = req.phone
        dbo.collection("library").aggregate([{$match: {phone: phone}}, {$group: {_id:"$question", count:{$sum:1}}}, {$match: {"count": {$gt: 1}}}]).toArray((err, result)=>{
            if(err)
                throw err
            res.send({success: true, message: result, status: 200})
        })
    
    })
    app.post('/trainer/clear-all-duplicates', isAuthenticated, (req, res)=>{
        let phone = req.phone
        let {questions} = req.body
        questions.map(q=>{
            let count = q.count
            for(let i =0;i<count-1;i++){
                dbo.collection("library").deleteOne({question: q._id, phone: phone})
            }
        })
        res.send({success: true, messsage: "Duplicates removed successfully", status: 200})
    })
    app.post('/trainer/update-question', isAuthenticated, (req, res)=>{
        let phone = req.phone
        let {question, id} = req.body
        dbo.collection("library").updateOne({_id: new ObjectID(id)}, {$set: {...question, updatedOn: new Date()}}, (err, result)=>{
            if(err)
                res.send({success: false, auth: true, message: err.message, status: 401})
            else    
                res.send({success: true, auth: true, message: "Updated Successfully", status: 200})
        })
        
    })
    app.post('/trainer/topics', isAuthenticated, (req, res)=>{
        let phone = req.phone
        dbo.collection('library').aggregate([{$match: {phone: phone}}, {$group: {_id:"$topic", count:{$sum:1}}}]).toArray((err, result)=>{
            if(err)
                throw err
            res.send({success: true, auth: true, message: result, status: 200})
        })
    })
    app.post('/trainer/add-topic', isAuthenticated, (req, res)=>{
        let phone = req.phone
        let {topic} = req.body
        dbo.collection("trainerTopics").findOne({phone: phone, topic: topic}, (err, result)=>{
                if(err)
                    logErrorReturn("Add Topic", err.message, res)
                if(result){
                    res.send({success: false, auth: true, message: "Topic already Exists", status: 200})
                }else{
                    dbo.collection("trainerTopics").insertOne({phone: phone, topic: topic, status: "Active", createdOn: new Date(), updatedOn: new Date()}, (err, result)=>{
                        if(err)
                            logErrorReturn("Add Topic", err.message, res)
                        else{
                            res.send({success: true, auth: true, message: "Added Successfully", status: 200})
                        }
                    })
                }
        })       
    })
    app.post('/trainer/set-topic-status', isAuthenticated, (req, res)=>{
        let phone = req.phone
        let {topic, status} = req.body
        dbo.collection("trainerTopics").findOne({phone: phone, topic: topic}, (err, result)=>{
            if(err) throw err
            if(result){
                dbo.collection("trainerTopics").updateOne({phone: phone, topic: topic}, {$set: {status: status, updatedOn: new Date()}}, (err, result)=>{
                    if(err)
                        res.send({success: false, auth: true, message: err.message, status: 401})
                    else    
                        res.send({success: true, auth: true, message: "Status Updated", status: 200})
                })
            }else{
                dbo.collection("trainerTopics").insertOne({phone: phone, topic: topic, status: status, createdOn: new Date(), updatedOn: new Date()}, (err, result)=>{
                    if(err)
                        res.send({success: false, auth: true, message: err.message, status: 401})
                    else    
                        res.send({success: true, auth: true, message: "Status Updated", status: 200})
                })
            }
        })
    })
    app.post('/trainer/set-question-status', isAuthenticated, (req, res)=>{
        let phone = req.phone
        let {id, status} = req.body
        dbo.collection("library").updateOne({phone: phone, _id: new ObjectID(id)}, {$set: {status: status, updatedOn: new Date()}}, (err, result)=>{
            if(err)
                res.send({success: false, auth: true, message: err.message, status: 401})
            else    
                res.send({success: true, auth: true, message: "Status Updated", status: 200})
        })
        
    })
    app.post('/trainer/get-topics-active', isAuthenticated, (req, res)=>{
        let phone = req.phone
        dbo.collection("trainerTopics").find({phone: phone, status: 'Active'}).toArray((err, result)=>{
            if(err)
                logErrorReturn("Trainer Topics", err.message, res)
            else    
                res.send({success: true, auth: true, message: result, status: 200})
        })
        
    })
    app.post('/trainer/get-topics-all', isAuthenticated, (req, res)=>{
        let phone = req.phone
        dbo.collection("trainerTopics").find({phone: phone}).toArray((err, result)=>{
            if(err)
                logErrorReturn("Trainer Topics", err.message, res)
            else{
                res.send({success: true, auth: true, message: result, status: 200})
            }   
        })   
    })
    app.post('/trainer/trainer-topics-filter', isAuthenticated, (req, res)=>{
        let phone = req.phone
        let {topic} = req.body
        dbo.collection("trainerTopics").find({phone: phone, topic: {$regex: topic, $options : 'i'}}).toArray((err, result)=>{
            if(err)
                logErrorReturn("Trainer Topics", err.message, res)
            else{
                res.send({success: true, auth: true, message: result, status: 200})
            }   
        }) 
    })
    app.post('/trainer/get-topics-all-num', isAuthenticated, (req, res)=>{
        let phone = req.phone 
        dbo.collection('library').aggregate([{$match: {phone: phone}}, {$group: {_id:"$topic", count:{$sum:1}}}]).toArray((err, result)=>{
            if(err){
                logErrorReturn("Library topics all num", err.message, res)
            }else{
                res.send({success: true, auth: true, message: result, status: 200})
            }
        })
    })
    app.post('/trainer/topics-questions', isAuthenticated, (req, res)=>{
        let phone = req.phone
        let topic = req.body.topic
        dbo.collection("library").find({phone: phone, topic: topic}).sort({updatedOn: -1}).toArray((err,result)=>{
            if(err)
                throw err;
            res.send({success: true, auth: true, message: result, status: 200})
        })  
    })
    app.post('/trainer/topics-questions-random', isAuthenticated, (req, res)=>{
        let phone = req.phone
        let topic = req.body.topic
        let num = parseInt(req.body.num)
        dbo.collection("library").aggregate([ {$match: {$and: [{topic:topic}, {phone: phone}]}}, {$sample: {size: num}}]).toArray((err,result)=>{
            if(err)
                throw err;
            res.send({success: true, auth: true, message: result, status: 200})
        })  
    })
    app.post('/trainer/upload-image', isAuthenticated, (req, res)=>{
        if(!req.files){
            res.send( {status: false, auth: true, message: "Not Files included!", status: 200})
        }else{
            const {desc} = req.body
            let file = req.files.image
            let filename = "diagram"+Date.now()+nanoid(10)+".png"
            let filepath = "./public/images/"+filename
            file.mv(filepath, err=>{
                if(err){
                    res.send({success: false, auth: true, message: err.message, status: 401})
                }else{
                    let url = req.protocol+'://'+req.headers.host+'/images/'+filename
                    let datao = {image: url, desc: desc, date: new Date()}
                    dbo.collection("imageLibrary").insertOne(datao, (err, result)=>{
                        if(err){
                            res.send({success: false, auth: true, message: err.message, status: 401})
                        }else{
                            res.send({success: true, auth: true, message: {message: "Uploaded Successfully", data: datao}, status: 200})
                        }                
                    })
                }
            })
        }
    })
    app.post('/trainer/upload-image-only', isAuthenticated, (req, res)=>{
        if(!req.files){
            res.send( {status: false, auth: true, message: "Not Files included!", status: 200})
        }else{
            let file = req.files.image
            let filename = "diagram"+Date.now()+nanoid(10)+".png"
            let filepath = "./public/images/"+filename
            file.mv(filepath, err=>{
                if(err){
                    res.send({success: false, message: err.message, status: 401})
                }else{
                    let url = req.protocol+'://'+req.headers.host+'/images/'+filename
                    res.send({success: true, message: url, status: 200})
                    
                }
            })
        }
    })
    app.post('/trainer/upload-profile-pic', isAuthenticated, (req, res)=>{
        let phone = req.phone
        console.log(phone)
        if(!req.files){
            res.send( {status: false, auth: true, message: "Not Files included!", status: 200})
        }else{
            let file = req.files.image
            let filename = "diagram"+Date.now()+nanoid(10)+".png"
            let filepath = "./public/images/"+filename
            file.mv(filepath, err=>{
                if(err){
                    res.send({success: false, message: err.message, status: 401})
                }else{
                    let url = req.protocol+'://'+req.headers.host+'/images/'+filename
                    dbo.collection(USERS).updateOne({phone: phone}, {$set: {profile_pic: url}})
                    res.send({success: true, message: url, status: 200})
                    
                }
            })
        }
    })
    app.post('/trainer/update-profile', isAuthenticated, (req, res)=>{
        let phone = req.phone
        let reqbody = req.body
        delete reqbody._id
        delete reqbody.phone

        dbo.collection(USERS).updateOne({phone: phone}, {$set: {...reqbody}}, (err, result)=>{
            if(err)
                throw err
            res.send({success: true, message: "Updated successfully", status: 200})
        })
    })
    app.post('/upload/upload-image-only', (req, res)=>{
        let file = req.files.image
        let filename = "diagram"+Date.now()+nanoid(10)+".png"
        let filepath = "./public/images/"+filename
        file.mv(filepath, err=>{
            if(err){
                res.send({success: false, auth: true, message: err.message, status: 401})
            }else{
                let url = req.protocol+'://'+req.headers.host+'/images/'+filename
                res.send({success: true, auth: true, message: url, status: 200})
                
            }
        })
    })
    app.post('/trainer/get-images', isAuthenticated, (req, res)=>{
        dbo.collection("imageLibrary").find({}).sort({date: -1}).toArray((err, result)=>{
            if(err)
                res.send({success: false, auth: true, message: err.message, status: 401})
            else{
                res.send({success: true, auth: true, message: result, status: 200})
            }
        })
    })
    app.get('/trainer/get-num-asm', isAuthenticated, (req, res)=>{
        let phone = req.phone
        dbo.collection("assessments").find({phone: phone}).project({_id: 1}).toArray((err, result)=>{
            if(err)
                throw err
            res.send({success: true, message: result.length, status: 200})
        })
    })
    app.get('/admin/get-total-test', isSamAuthenticated, (req, res)=>{
        dbo.collection("assessments").count({}, (err, result)=>{
            if(err)
                throw err
            res.send({success: true, message: result, status: 200})
        })
    })
    app.get('/admin/get-total-trainers', isSamAuthenticated, (req, res)=>{
        dbo.collection("users").count({}, (err, result)=>{
            if(err)
                throw err
            res.send({success: true, message: result, status: 200})
        })
    })
    app.get('/admin/get-total-mock-test', isSamAuthenticated, (req, res)=>{
        dbo.collection(MOCKTEST).count({}, (err, result)=>{
            if(err)
                throw err
            res.send({success: true, message: result, status: 200})
        })
    })
    app.get('/trainer/get-num-qns', isAuthenticated, (req, res)=>{
        let phone = req.phone
        dbo.collection("library").find({phone: phone}).project({_id: 1}).toArray((err, result)=>{
            if(err)
                throw err
            res.send({success: true, message: result.length, status: 200})
        })
    })
    app.get('/trainer/get-num-topics', isAuthenticated, (req, res)=>{
        let phone = req.phone
        dbo.collection("library").aggregate([{$match: {phone: phone}}, {$group: {_id:"$topic", count:{$sum:1}}}]).toArray((err, result)=>{
            if(err)
                throw err
            res.send({success: true, message: result.length, status: 200})
        })
    })
    
    app.post('/sam/login', (req, res)=>{
        const {username, password} = req.body
        dbo.collection("admin").findOne({username: username},(err, result)=>{
            if(err)
                res.send({success: false, message: 'Some error occured', status: 200})
            if(result){
                let un = result.username
                let pwd = result.password
                let check1 = un === username
                bcrypt.compare(password, pwd, function(err, result) {
                    if(err)
                        res.send({success: false, message: 'Some error occured', status: 200})
                    let check2 = result
                    if(check1 && check2){
                        const token = jwt.sign({ username: username, password: password}, process.env.JWT_SECRET, { expiresIn: '30d' })
                        res.send({success: true, message: {token: token}, status: 200})
                    }else{
                        res.send({success: false, message: 'Invalid Credentials!!', status: 200})
                    }
                });
            }else{
                res.send({success: false, message: 'Invalid Credentials!!', status: 200})
            }
        })
    })
    app.post('/sam/reset-password', isSamAuthenticated,  (req, res)=>{
        const {cp, confpass, newpass} = req.body
        if(password !== cp){
            res.send({success: false, auth: false, message: "Your current password not matching!", status: 200})
        }else if(confpass !== newpass){
            res.send({success: false, auth: false, message: "Passwords not matching!", status: 200})
        }else{
            const username = req.username
            bcrypt.hash(newpass, saltRounds, function(err, hash) {
                if(err)
                    res.send({success: false, auth: true, message: err.message, status: 401})
                dbo.collection("admin").updateOne({username: username}, {$set:{password: hash}}, (err, result)=>{
                    if(err)
                        res.send({success: false, auth: true, message: err.message, status: 401})
                    const token = jwt.sign({username: username, password: newpass}, process.env.JWT_SECRET, { expiresIn: '30d' })
                    res.send({success: true, auth: true, message: {message: "Updated Successfully", token: token}, status: 200})
                })
            })
        } 
    })
    app.post('/sam/add-categories', isSamAuthenticated, (req, res)=>{
        const username = req.username
        const {category} = req.body
        dbo.collection("samCategories").findOne({username: username, category: category}, (err,result)=>{
            if(err)
                res.send({success: false, auth: true, message: err.message, status: 401})
            if(!result){
                dbo.collection("samCategories").insertOne({username, category}, (err,result2)=>{
                    if(err)
                        res.send({success: false, auth: true, message: err.message, status: 401})
                    res.send({success: true, auth: true, message: "Added Successfully", status: 200})
                    
                })
            }else{
                res.send({success: false, auth: true, message: "Category already exists", status: 200})
            }
        })
    })
    app.post('/sam/get-categories', isSamAuthenticated, (req, res)=>{
        const username = req.username
        dbo.collection("samCategories").find({username}, {projection:{category: 1}}).toArray((err, result)=>{
            if(err)
                res.send({success: false, auth: true, message: err.message, status: 401})
            res.send({success: true, auth: true, message: result, status: 200})
        })
    })
    app.post('/sam/get-audit-logs', isSamAuthenticated, (req, res)=>{
        const username = req.username
        dbo.collection("auditLog").find({}).sort({date: -1}).toArray((err, result)=>{
            if(err)
                res.send({success: false, auth: true, message: err.message, status: 401})
            res.send({success: true, auth: true, message: result, status: 200})
        })
    })
    app.post('/sam/add-question', isSamAuthenticated, (req, res)=>{
        const username = req.username
        const {category, topic, question} = req.body 
        
    })
    app.post('/sam/add-question-group', isSamAuthenticated, (req, res)=>{
        let {questions, topics, categories} = req.body
        dbo.collection(SAMLIBRARY).insertMany(questions, (err, result)=>{
            if(err){
                logErrorReturn("Admin add-question-group", err.message, res)
            }else{
                topics.map(t=>{
                    dbo.collection("samTopics").findOne({category: t.category, topic: t.topic}, (err, result)=>{
                        if(!result){
                            dbo.collection("samTopics").insertOne({category: t.category, topic: t.topic, status: "Active", createdOn: new Date(), updatedOn: new Date()})
                        }
                    })
                })
                categories.map(c=>{
                    dbo.collection("samCategories").findOne({category: c.category}, (err, result)=>{
                        if(!result){
                            dbo.collection("samCategories").insertOne({category: c.category, status: "Active",  createdOn: new Date(), updatedOn: new Date()}) 
                        }
                    })
                })
                res.send({success: true, auth: true, message: "Added Successfully", status: 200})
            }
        })
    }) 
    app.post('/sam/upload-image', isSamAuthenticated, (req, res)=>{
        if(!req.files){
            res.send( {status: false, auth: true, message: "Not Files included!", status: 200})
        }else{
            const {desc} = req.body
            let file = req.files.image
            let filename = "diagram"+Date.now()+nanoid(10)+".png"
            let filepath = "./public/images/"+filename
            file.mv(filepath, err=>{
                if(err){
                    res.send({success: false, auth: true, message: err.message, status: 401})
                }else{
                    let url = req.protocol+'://'+req.headers.host+'/images/'+filename
                    let datao = {image: url, desc: desc, date: new Date()}
                    dbo.collection("imageLibrary").insertOne(datao, (err, result)=>{
                        if(err){
                            res.send({success: false, auth: true, message: err.message, status: 401})
                        }else{
                            res.send({success: true, auth: true, message: {message: "Uploaded Successfully", data: datao}, status: 200})
                        }                
                    })
                }
            })
        }
    })
    app.post('/sam/get-images', isSamAuthenticated, (req, res)=>{
        dbo.collection("imageLibrary").find({}).sort({date: -1}).toArray((err, result)=>{
            if(err)
                res.send({success: false, auth: true, message: err.message, status: 401})
            else{
                res.send({success: true, auth: true, message: result, status: 200})
            }
        })
    })
    app.post('/sam/add-category', isSamAuthenticated, (req, res)=>{
        let username = req.username
        let {category} = req.body
        dbo.collection("samCategories").findOne({category: category}, (err, result)=>{
            if(err)
                logErrorReturn("Admin  Add category", err.message, res)
            if(result){
                res.send({success: false, auth: true, message: "Category already exists", status: 200})
            }else{
                let inserto = {username: username, category: category, status: "Active",  createdOn: new Date(), updatedOn: new Date()}
                dbo.collection("samCategories").insertOne(inserto, (err, result)=>{
                    if(err)
                        logErrorReturn("Admin  Add category", err.message, res)
                    else res.send({success: true, message: "Added successfully", status: 200})
                })  
            }
        })
    })
    app.get('/sam/get-categories-all', isSamAuthenticated, (req, res)=>{
        dbo.collection("samCategories").find({}).sort({createdOn: -1}).toArray((err, result)=>{
            if(err)
                logErrorReturn("Admin get Categories", err.message, res)
            else res.send({success: true, message: result, status: 200})
        })
    })
    app.post('/sam/set-category-status', isSamAuthenticated, (req, res)=>{
        let {category, status} = req.body
        dbo.collection("samCategories").updateOne({category: category}, {$set: {status: status}}, (err, result)=>{
            if(err)
                logErrorReturn("Admin set Category Status", err.message, res)
            else {
                let message
                if(result.modifiedCount>0){
                    message = "Updated successfully"
                }else{
                    message = "Nothing to Update"
                }
                res.send({success: true, message: message, status: 200})
            }
        })
    })
    app.post('/sam/add-topic', isSamAuthenticated, (req, res)=>{
        const {topic, category} = req.body
        dbo.collection("samTopics").findOne({category, topic}, (err,result)=>{
            if(err)
                logErrorReturn("Get topics", err.message, res)
            else{
                if(!result){
                    dbo.collection("samTopics").insertOne({category: category, topic: topic, status: "Active", createdOn: new Date(), updateOn: new Date()}, (err,result2)=>{
                        if(err)
                            logErrorReturn("Admin add topic", err.message, res)
                        else{
                            res.send({success: true, auth: true, message: "Added Successfully", status: 200})
                        }
                    })
                }else{
                    res.send({success: false, auth: true, message: "Topic already exists", status: 200})
                }
            }
        })
    })
    app.post('/sam/get-category-topics', isSamAuthenticated, (req, res)=>{
        const {category} = req.body
        dbo.collection("samTopics").find({category: category}).sort({createdOn: -1}).toArray((err, result)=>{
            if(err)
                logErrorReturn("Admin get Topics", err.message, res)
            else res.send({success: true, message: result, status: 200})
        })
    })
    app.get('/sam/get-topics-all', isSamAuthenticated, (req, res)=>{
        dbo.collection("samTopics").find({}).sort({createdOn: -1}).toArray((err, result)=>{
            if(err)
                logErrorReturn("Admin get Topics", err.message, res)
            else res.send({success: true, message: result, status: 200})
        })
    })
    app.post('/sam/get-topics-num', isSamAuthenticated, (req, res)=>{
        const {category} = req.body
        dbo.collection(SAMLIBRARY).aggregate([{$match: {category: category}}, {$group: {_id:"$topic", count:{$sum:1}}}]).toArray((err, result)=>{
            if(err){
                logErrorReturn("Library topics all num", err.message, res)
            }else{
                res.send({success: true, message: result, status: 200})
            }
        })
    })
    app.post('/sam/get-topics-search', isSamAuthenticated, (req, res)=>{
        let {category, topic} = req.body
        dbo.collection("samTopics").find({category: category, topic: {$regex: topic, $options : 'i'}}).toArray((err, result)=>{
            if(err)
                logErrorReturn("Admin Topic Search", err.message, res)
            else{
                res.send({success: true, message: result, status: 200})
            }   
        }) 
    })
    app.post('/sam/get-categories-search', isSamAuthenticated, (req, res)=>{
        let {category} = req.body
        dbo.collection("samCategories").find({category: {$regex: category, $options : 'i'}}).toArray((err, result)=>{
            if(err)
                logErrorReturn("Admin Category Search", err.message, res)
            else{
                res.send({success: true, message: result, status: 200})
            }   
        }) 
    })
    app.post('/sam/add-qn-lib-man', isAuthenticated, (req, res)=>{
        let {question, category, topic, options} = req.body
        dbo.collection(SAMLIBRARY).insertOne({category: category, topic: topic, question: question, options: options, status: "Active", createdOn: new Date(), updatedOn: new Date()}, (err, result)=>{
            if(err){
                logErrorReturn("Super Admin add question to library manually", err.message, res)
            }else{
                dbo.collection("samCategories").findOne({category: category}, (err, result)=>{
                    if(err)
                        throw err
                    else{
                        if(!result)
                            dbo.collection("samCategories").insertOne({category: category, status: "Active", createdOn: new Date(), updatedOn: new Date()})
                        
                    }
                })
                dbo.collection("samTopics").findOne({category: category, topic: topic}, (err, result)=>{
                    if(err)
                        throw err
                    else{
                        if(!result)
                            dbo.collection("samTopics").insertOne({category: category, topic: topic, status: "Active", createdOn: new Date(), updatedOn: new Date()})
                        
                    }
                })
                res.send({success: true, message: "Added Successfully", status: 200})
            }
        })
    })
    app.post('/sam/set-topic-status', isSamAuthenticated, (req, res)=>{
        let {category, topic, status} = req.body
        dbo.collection("samTopics").updateOne({category: category, topic: topic}, {$set: {status: status}}, (err, result)=>{
            if(err)
                logErrorReturn("Admin set Topic Status", err.message, res)
            else {
                if(result.modifiedCount>0){
                    res.send({success: true, message: "Updated successfully", status: 200})
                }else{
                    res.send({success: false, auth: true, message: "Nothing to Update", status: 200})
                }
            }
        })
    })
    app.post('/sam/delete-qn-lib', isSamAuthenticated, (req, res)=>{
        let {qid} = req.body
        dbo.collection(SAMLIBRARY).deleteOne({_id: ObjectId(qid)}, (err, result)=>{
            if(err){
                logErrorReturn("delete question from library", err.message, res)
            }else{
                res.send({success: true, message: "Deleted Successfully", status: 200})    
            }
        })
    })
    app.post('/sam/topic-questions', isSamAuthenticated, (req, res)=>{
        let {category, topic} = req.body
        dbo.collection(SAMLIBRARY).find({category, topic}).toArray((err, result)=>{
            if(err)
                logErrorReturn("Admin get topic Questions", err.message, res)
            else{
                res.send({success: true, message: result, status: 200})
            }
        })
    })
    app.post('/sam/update-question', isAuthenticated, (req, res)=>{
        let {question, id} = req.body
        dbo.collection(SAMLIBRARY).updateOne({_id: ObjectId(id)}, {$set: {...question, updatedOn: new Date()}}, (err, result)=>{
            if(err)
                logErrorReturn("Admin update question", err.message, res)
            else    
                res.send({success: true, message: "Updated Successfully", status: 200})
        })
    })
    app.post('/sam/set-question-status', isSamAuthenticated, (req, res)=>{
        let {id, status} = req.body
        dbo.collection(SAMLIBRARY).updateOne({_id: ObjectId(id)}, {$set: {status: status, updatedOn: new Date()}}, (err, result)=>{
            if(err)
                res.send({success: false, auth: true, message: err.message, status: 401})
            else    
                res.send({success: true, message: "Status Updated", status: 200})
        })
        
    })
    app.post('/sam/get-subcategories', isSamAuthenticated, (req, res)=>{
        let {category} = req.body
        dbo.collection(MOCKTEST).distinct("subCategory", {category: category}, (err, result)=>{
            if(err)
                throw err
            res.send({success: true, message: result, status: 200})
        })
    })
    app.post('/sam/create-mocktest', isSamAuthenticated, (req, res)=>{
        const {assessment} = req.body
        assessment.linkCode = uuidv4()
        assessment.createdOn = new Date()
        assessment.updatedOn = new Date()
        dbo.collection(MOCKTEST).insertOne(assessment, (err, result)=>{
            if(err)
                logErrorReturn("Create mock test", err.message, res)
            else{
                res.send({success: true, message: "Assessment created successfully", status: 200})
            }
        })
    })
    app.post('/sam/get-mocktests', isSamAuthenticated, (req, res)=>{
        dbo.collection(MOCKTEST).find({}).project({title: 1, banner: 1, linkCode: 1, duration: 1, category: 1, subCategory: 1, numTopics: 1, numQns: 1, createdOn: 1}).sort({updatedOn: -1}).toArray((err, result)=>{
            if(err)
                throw err
            else{
                res.send({success: true, message: result, status: 200})
            }
        })
    })
    app.post('/save-mocktest', (req, res)=>{
        const reqBody = req.body
        reqBody.createdOn = new Date()
        reqBody.updateOn = new Date()
        dbo.collection(MOCKTEST_SHEETS).insertOne(reqBody, (err, result)=>{
            if(err) throw err
            res.send({success: true, message: "saved sucessfully"})
        })
    })
    app.get('/get-user-sheets/:linkCode', (req, res)=>{
        const {linkCode} = req.params
        dbo.collection(MOCKTEST_SHEETS).find({linkCode: linkCode}).toArray((err, result)=>{
            if(err) throw err
            res.send({success: true, message: result})
        })
    })
    app.get('/get-user-sheet/:id', (req, res)=>{
        const {id} = req.params
        dbo.collection(MOCKTEST_SHEETS).findOne({_id: id}, (err, result)=>{
            if(err) throw err
            res.send({success: true, message: result})
        })
    })
    app.get('/get-categories', (req, res)=>{
        dbo.collection("samCategories").find({}).sort({createdOn: -1}).toArray((err, result)=>{
            if(err)
                throw err
            
            res.send({success: true, message: result, status: 200})
        })
    })
    app.post('/get-sub-cats', (req, res)=>{
        const {cat} = req.body
        dbo.collection(MOCKTEST).distinct("subCategory", {category: cat}, (err, result)=>{
            if(err)
                throw err
            res.send({success: true, message: result, status: 200})
        })
    })
    app.post('/get-st-assessments', (req, res)=>{
        const {cat, subcat} = req.body
        dbo.collection(MOCKTEST).find({category: cat, subCategory: subcat}).sort({createdOn: -1}).toArray((err, result)=>{
            if(err)
                throw err
            res.send({success: true, message: result, status: 200})
        })
    })
    app.get('/get-mock-test/:linkCode', (req, res)=>{
        const {linkCode} = req.params
        dbo.collection(MOCKTEST).findOne({linkCode}, async(err, result)=>{
            if(err)
                throw err
            if(result){
                const ASSESSMENT = result
                let qns = await result.questions.map(async mp=>{
                    let topic = mp.topic
                    let numQns = parseInt(mp.numQns)
                    const result1 = await dbo.collection(SAMLIBRARY).aggregate([{$match: {topic: topic, status: 'Active'}}, { $sample: { size: numQns} }]).toArray()
                    //questions.concat(result1)
                    return result1
                })
                let tempA = []
                const ms = await Promise.all(qns)
                let questions = tempA.concat(...ms)
                ASSESSMENT.allquestions = questions
                res.send({success: true, message: ASSESSMENT, status: 200})
                
            }else{
                res.send({success: false, message: "No Mocktest Found", status: 404})
            }
        })
    })
    app.post('/contact-us', (req, res)=>{
        const {message, phone, email} = req.body
        
        dbo.collection(CONTACT_US).insertOne({message, phone, email, createdOn: new Date()}, (err, result)=>{
            if(err) throw err
            res.send({success: true, message: "Saved Successfully"})
        })
    })


    io.on('connection', (socket) => {
        //console.log("a user connected "+socket.id)
        socket.on('disconnect', () => {
           let ind = students.findIndex(s=>s.id === socket.id)
           if(ind !== -1){
                let student = students[ind]
                students.splice(ind, 1)
                io.emit('gone-'+student.linkCode, {name: student.name, id: student.id})
           }
        })
        socket.on("test_live", m=>{
            //console.log(m)
            //
        })
        socket.on("sendAttendants", m=>{
            let linkCode = m.linkCode
            let ar = students.filter(s=>s.linkCode === linkCode)
            io.emit('onNumber-'+linkCode, ar)
        })
        socket.on("joining", m=>{
            let id = socket.id
            let student = {...m, id: id}
            students.push(student)
            io.emit('joined-'+m.linkCode, {...m, id: id})
        })
        socket.on("goLive", m=>{
            let id = socket.id
            let ind = students.findIndex(fd=>fd.id === id)
            if(ind === -1){
                let student = {...m, id: id}
                students.push(student)
            }else{
                let student = students[ind]
                student.score = m.score
                student.status = m.status
                student.numAttempted = m.numAttempted
            }
            io.emit('goLive-'+m.linkCode, {...m, id: id})
        })
        socket.on('start', m=>{
            let linkCode = m.linkCode
            io.emit("start-"+linkCode, "start") //
        })
        socket.on('end', m=>{
            let linkCode = m.linkCode
            io.emit("end-"+linkCode, "end") // 
        })
    })
})