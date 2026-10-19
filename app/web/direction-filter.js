import {indicators} from './engine.js';
export function makeDirectionFilter(rows,until=Infinity){
 const bars=indicators(rows,until);
 function at(time){let lo=0,hi=bars.length;while(lo<hi){const mid=(lo+hi)>>1;if(bars[mid].at<=time)lo=mid+1;else hi=mid;}return lo?bars[lo-1]:null;}
 function veto(signal){const b=at(signal.at);if(!b?.ready)return 'Direção4h sem histórico suficiente';return b.side===signal.side?null:'Direção4h contrária ou neutra';}
 return {at,veto};
}
