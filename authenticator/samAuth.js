const jwt = require('jsonwebtoken')
const isSamAuthenticated = (req, res, next)=>{
    const {token} = req.headers
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded)=>{
        if(err){
          res.send({success: false, auth: false, message: err.message, status: 401})
        }else{
            const username = decoded.username
            const password = decoded.password
            req.username = username
            next()
        }
    })
}
module.exports = isSamAuthenticated