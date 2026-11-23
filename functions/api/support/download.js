import {serveSupportAttachment} from '../../../services/support/cloudflare/download.mjs';
export async function onRequest(context){return serveSupportAttachment(context);}
