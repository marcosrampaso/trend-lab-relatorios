import {RESEARCH_POLICY as prior,researchFitness} from './donchian-research-policy-v2.mjs';
import {GENES,genomeID,randomSource,randomGenome,genomeSpace} from './donchian-genetic-exits-v3.mjs';
export {researchFitness};
export const RESEARCH_POLICY={...prior,partialFraction:.5};
const entries=GENES.maxHours.length*GENES.toleranceATR.length*GENES.confirmationATR.length*GENES.invalidationATR.length+1;
const exits=GENES.targetR.length+GENES.targetR.reduce((n,y)=>n+GENES.firstR.filter(x=>x<y).length,0);
export const SEARCH_SPACE_SIZE=entries*GENES.trend.length*GENES.stopATR.length*GENES.holdMinutes.length*GENES.cooldownMinutes.length*exits;
export function moreUnseenPopulation(population,seen,{seed,generation,size=24}){const r=randomSource(seed+generation*7919),out=new Map();for(const g of population.slice(0,4))out.set(genomeID(g),g);for(const g of population.slice(4))if(!seen.has(genomeID(g)))out.set(genomeID(g),g);for(let i=0;out.size<size&&i<20000;i++){const g=randomGenome(r),id=genomeID(g);if(!seen.has(id))out.set(id,g);}if(out.size<size)for(const g of genomeSpace()){const id=genomeID(g);if(!seen.has(id))out.set(id,g);if(out.size>=size)break;}return {genomes:[...out.values()].slice(0,size),unseen:[...out.keys()].filter(id=>!seen.has(id)).length,exhausted:seen.size>=SEARCH_SPACE_SIZE};}
