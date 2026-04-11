const jwt=require('jsonwebtoken');

const protect=(req,res,next) => {

    const authHeader=req.headers['authorization'];

    const token=authHeader && authHeader.split(' ')[1];

    if(!token){
        return res.status(401).json({message:'No token provided, access denied'});
    }
    try {
        const decoded=jwt.verify(token,process.env.ACCESS_TOKEN_SECRET);
        req.user=decoded;
        next();
    }
    catch(err){
        return res.status(403).json({message: 'Invalid or expired token'});
    }
}
module.exports=protect;