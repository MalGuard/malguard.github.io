import {apiUrl} from './api.js';

async function request(endpoint,body){
  const response=await fetch(apiUrl(endpoint),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'The account service is unavailable.');return data;
}

export const sendEmailCode=({email,username,profile})=>request('auth/start',{email,username,profile});
export const checkAccountAvailability=({email,username})=>request('auth/availability',{email,username});
export const verifyEmailCode=({verificationToken,code})=>request('auth/verify',{verificationToken,code});
export const signInWithPassword=({email,password})=>request('auth/password',{email,password});
export const completeGoogleSignup=({signupToken,profile})=>request('auth/google/complete-signup',{signupToken,profile});
export const readEmailSession=sessionToken=>request('auth/session',{sessionToken});
