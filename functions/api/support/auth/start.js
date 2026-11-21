import {handleSupport} from '../../../../services/support/cloudflare/ticket-api.mjs';
export async function onRequest(context) {
 return handleSupport(context,'auth/start');
}
