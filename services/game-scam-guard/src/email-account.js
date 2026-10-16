// Account creation, OTP verification, throttling and session persistence belong
// to the identity provider. This app never invents an OTP or stores a password.
export async function sendEmailCode(clerk,mode,details){
  const email=typeof details==='string'?details:details?.email;
  if(mode==='signup'){
    const username=details?.username?.trim();const password=details?.password;
    if(!username||!password)throw Object.assign(new Error('signup_details_required'),{code:'signup_details_required'});
    const attempt=await clerk.client.signUp.create({username,emailAddress:email,password});
    await attempt.prepareEmailAddressVerification({strategy:'email_code'});
    return attempt;
  }
  const attempt=await clerk.client.signIn.create({identifier:email});
  const factor=attempt.supportedFirstFactors?.find(f=>f.strategy==='email_code');
  if(!factor)throw Object.assign(new Error('email_code_unavailable'),{code:'email_code_unavailable'});
  await attempt.prepareFirstFactor({strategy:'email_code',emailAddressId:factor.emailAddressId});
  return attempt;
}
export async function resendEmailCode(attempt,mode){
  if(mode==='signup')return attempt.prepareEmailAddressVerification({strategy:'email_code'});
  const factor=attempt.supportedFirstFactors?.find(f=>f.strategy==='email_code');
  if(!factor)throw Object.assign(new Error('email_code_unavailable'),{code:'email_code_unavailable'});
  return attempt.prepareFirstFactor({strategy:'email_code',emailAddressId:factor.emailAddressId});
}
export async function verifyEmailCode(clerk,attempt,mode,code){
  if(!/^\d{6}$/.test(code))throw Object.assign(new Error('invalid_code'),{code:'invalid_code'});
  const result=mode==='signup'?await attempt.attemptEmailAddressVerification({code}):await attempt.attemptFirstFactor({strategy:'email_code',code});
  if(result.status!=='complete'||!result.createdSessionId)throw Object.assign(new Error('additional_verification_required'),{code:'additional_verification_required'});
  await clerk.setActive({session:result.createdSessionId});
  // setActive must actually establish a verified provider session.
  if(!clerk.session||!clerk.user)throw Object.assign(new Error('session_not_ready'),{code:'session_not_ready'});
  return clerk.user;
}
