const jwt = require('jsonwebtoken')
const isAuthenticated = (req, res, next)=>{
    const {token} = req.headers
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded)=>{
        if(err){
          res.send({success: false, auth: false, message: err.message, status: 401})
        }else{
         let phone = decoded.phone
         req.phone = phone
         next()
        }
    })
}
module.exports = isAuthenticated