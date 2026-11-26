import stock from './index.mjs';
import voice from './voice_pilot.mjs';
export default {fetch(req,env,ctx){return new URL(req.url).pathname.startsWith('/voice/')?voice(req,env):stock.fetch(req,env,ctx);}};
