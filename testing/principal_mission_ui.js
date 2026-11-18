function renderMissionHome() {
 const [featured,...others]=PRESET_DECKS;
 const titles=['Costas + tríceps','Braços + ombros','Pernas completas'];
 return `<section class="mission-home" aria-labelledby="mission-title">
  <img class="mission-cover" src="./mission-cover.webp" width="533" height="267" alt="Treino &amp; Evolução. Dois atletas em uma academia ao ar livre, com a cidade ao pôr do sol.">
  <h1 id="mission-title">Sua próxima missão</h1>
  <article class="mission-feature">
   <button type="button" class="mission-feature-preview" data-coach-action="preset" data-preset-id="${e(featured.id)}" aria-label="Ver deck de ${e(featured.name)}">
    <img src="./mission-deck.webp" width="146" height="97" alt="">
    <span><small>Deck 01</small><strong>Peito + bíceps</strong><span>${featured.items.length} exercícios</span></span>
   </button>
   <button type="button" class="btn primary block mission-start" data-coach-action="start-mission" data-mission-id="${e(featured.id)}">Iniciar treino</button>
  </article>
  <div class="mission-list">${others.map((deck,i)=>`<button type="button" class="mission-choice" data-coach-action="preset" data-preset-id="${e(deck.id)}">
   <img src="${i===0?'./mission-deck.webp':'./mission-avenue.webp'}" width="70" height="48" alt="">
   <span><small>Deck 0${i+2}</small> <strong>${e(titles[i])}</strong></span><span aria-hidden="true">›</span>
  </button>`).join('')}</div>
 </section>`;
}

function renderMissionExerciseArt(name,equipment) {
 const image=exerciseArt(name,equipment);
 if(!image)return '';
 const source=image.src==='./exercise-supino-inclinado-halteres.webp'?'./mission-incline.webp':image.src;
 return `<img class="mission-exercise-art" src="${e(source)}" alt="" decoding="async">`;
}

function renderMissionRecent(active,selected,m) {
 if(!selected)return '';
 const rows=m.sets.filter(row=>row.session_id===active.id&&row.variant_id===selected&&!row.finisher_key&&row.set_type!=='drop_set').slice(-2);
 const unit=m.variantMap.get(selected)?.unit||'';
 return rows.length?`<ul class="mission-recent" aria-label="Séries registradas">${rows.map(row=>`<li>
  <strong><span aria-hidden="true">✓</span> Série ${e(row.set_number)}</strong>
  <span>${e(row.load_value??'—')} ${e(row.load_unit_original||unit)} × ${e(row.repetitions??'—')} rep</span>
  <small>Concluída</small>
 </li>`).join('')}</ul>`:'';
}

function renderMissionNext(active,selected,m) {
 const next=nextPending(active,selected,m.entities);
 if(!next||next===selected)return '';
 const variant=m.variantMap.get(next);
 const name=m.exerciseMap.get(variant?.exercise_id)?.name;
 if(!name)return '';
 const art=exerciseArt(name,variant.equipment_or_variation);
 return `<button type="button" class="mission-choice mission-next" data-coach-action="select" data-coach-variant="${e(next)}">
  ${art?`<img src="${e(art.src)}" width="66" height="48" alt="">`:'<span class="mission-next-mark" aria-hidden="true">→</span>'}
  <span><small>Próximo exercício</small><strong>${e(name)}</strong></span><span aria-hidden="true">›</span>
 </button>`;
}
