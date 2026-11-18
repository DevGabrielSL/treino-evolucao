import { exerciseArt } from '../legacy/principal_exercise_art.js';
import { classifyExercise } from '../legacy/balanced_coach.js';
import { asset, hasAsset } from './assets';

// Usa a ilustração do exercício quando ela existe em src/assets/art (estilo litoral/neon).
// Para adicionar uma nova, basta salvar o arquivo com o nome exercise-<slug>.webp (ver docs/ILUSTRACOES.md).
// Os demais exercícios usam um cartão gerado.
const COVER: Record<string, string> = { peito: '01', biceps: '01', costas: '02', triceps: '02', ombros: '03', pernas: '04', core: '03' };
const LABEL: Record<string, string> = { peito: 'Peito', biceps: 'Bíceps', costas: 'Costas', triceps: 'Tríceps', ombros: 'Ombros', pernas: 'Pernas', core: 'Core' };

export function exerciseImage(name?: string, equipment?: string) {
  const src: string | undefined = exerciseArt(name || '', equipment || '')?.src;
  const slug = src?.match(/exercise-(.+)\.webp$/)?.[1];
  return slug && hasAsset(`exercise-${slug}.webp`) ? asset(src!) : null;
}

export function ExerciseVisual({ name, equipment, size = 'lg', className = '' }: { name?: string; equipment?: string; size?: 'sm' | 'lg'; className?: string }) {
  const img = exerciseImage(name, equipment);
  const group = classifyExercise({ name }) || 'core';
  if (img) return <img src={img} alt="" className={`duotone size-full object-cover ${className}`} />;
  return (
    <div className={`relative size-full overflow-hidden ${className}`}>
      <img src={asset(`deck-cover-${COVER[group] || '01'}.webp`)} alt="" className="absolute inset-0 size-full object-cover blur-[2px] scale-110 opacity-70" />
      <div className="absolute inset-0 bg-gradient-to-br from-violet/40 via-transparent to-pink/40" />
      <span className={`absolute font-display uppercase text-transparent [-webkit-text-stroke:1.5px_rgba(255,244,230,.55)] leading-none ${size === 'lg' ? 'text-[5.5rem] -right-2 top-2' : 'text-[1.05rem] left-1 bottom-1'}`}>{LABEL[group]}</span>
    </div>
  );
}
