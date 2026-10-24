// Keep the transport independent of the page so streaming and cancellation can be checked.
export async function streamAnswer(provider, messages, {signal, onText}) {
 const stream=await provider.ai.chat(messages,{stream:true,max_tokens:2048,signal});
 let answer='';
 for await(const part of stream){
  if(signal.aborted)throw new DOMException('Stopped','AbortError');
  if(part.type==='error')throw new Error(part.message||'The AI provider stopped the response.');
  if(typeof part.text==='string'){answer+=part.text;onText(answer)}
 }
 if(signal.aborted)throw new DOMException('Stopped','AbortError');
 if(!answer.trim())throw new Error('No answer arrived. Please try again.');
 return answer;
}
