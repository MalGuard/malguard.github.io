import {supportHealth} from '../../../services/support/cloudflare/ticket-api.mjs';
export async function onRequestGet({env}) {
 return supportHealth(env);
}
