// Cancel only an active local session. Never delete a session or any performed sets.
export function cancelLocalSession(doc,id){
 const session=doc.overlay.sessions.find(x=>x.id===id);
 if(!session||session.status!=='in_progress'||session.provenance?.sheet)throw new Error('Treino local em andamento não encontrado.');
 session.status='cancelled';
 return session;
}
