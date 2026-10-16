import { describe, expect, it } from 'vitest';
import { findPlaces } from '../src/lib/geo/gazetteer';
import { classify, isDenial } from '../src/lib/engine/classify';

const names = (t: string) => findPlaces(t).map((p) => p.name);

describe('place matching', () => {
  it('handles Albanian case endings and missing ë', () => {
    expect(names('Protesta në Tiranë')).toContain('Tiranë');
    expect(names('Studentët e Durrësit dalin në rrugë')).toContain('Durrës');
    expect(names('Aksident në hyrje të Shkodrës')).toContain('Shkodër');
    expect(names('Protesta ne Tirane')).toContain('Tiranë');
    expect(names('Zjarr në Vlorë')).toContain('Vlorë');
  });
  it('finds Tirana landmarks', () => {
    expect(names('Protestuesit para Kryeministrisë')).toContain('Kryeministria');
    expect(names('Përplasje te Ministria e Arsimit')).toContain('Ministria e Arsimit');
    expect(names('Tubim në Sheshin Skënderbej')).toContain('Sheshi Skënderbej');
  });
  it('uses institution buildings as places only when asked (protests), not in other stories', () => {
    expect(findPlaces('Oficeri i policisë, Ministria e Brendshme nis hetimin').map((p) => p.name)).toContain('Ministria e Brendshme');
    expect(findPlaces('Oficeri i policisë, Ministria e Brendshme nis hetimin', false).map((p) => p.name)).not.toContain('Ministria e Brendshme');
    expect(findPlaces('Protestuesit te Sheshi Skënderbej', false).map((p) => p.name)).toContain('Sheshi Skënderbej');
  });
  it('does not treat the Prime Minister (person) or first names as places', () => {
    expect(names('Kryeministri Rama: nuk jap dorëheqjen')).not.toContain('Kryeministria');
    expect(names('Blerim Hoti deklaroi sot')).toEqual([]);
    expect(names('Protesta, Bushati: U prishën pesë semaforë')).toEqual([]);
  });
});

describe('categories', () => {
  it('classifies Albanian and English text', () => {
    expect(classify('Protesta e studentëve para Ministrisë', 'news')).toBe('demonstration');
    expect(classify('Policia hedh gaz lotsjellës', 'news')).toBe('demonstration');
    expect(classify('Bllokohet rruga Tiranë-Durrës', 'news')).toBe('road-closure');
    expect(classify('Aksident në autostradë, dy të plagosur', 'news')).toBe('emergency');
    expect(classify('Tërmet 4.1 ballë në Durrës', 'news')).toBe('hazard');
    expect(classify('Students rally outside ministry', 'news')).toBe('demonstration');
    expect(classify('Kultura dhe arti sot', 'news')).toBe('other');
    expect(classify('Orë edukative me nxënësit', 'police')).toBe('police-notice');
    expect(classify('Qeveria miraton buxhetin', 'news')).toBe('other');
    expect(classify('Qeveria miraton buxhetin', 'official')).toBe('official-notice');
  });
  it('keeps sports and politics out of protest/police categories', () => {
    expect(classify('Egnatia debutim pozitiv në Ligën e Konferencës/ Takimi në “Elbasan Arena” përfundoi 1-1', 'news')).toBe('other');
    expect(classify('Tifozët protestojnë pas humbjes 0-3 në stadium', 'news')).toBe('other');
    expect(classify('Rama qesh kur pyetet për zërat se do të arrestohet', 'news')).toBe('other');
    expect(findPlaces('Përplasje pranë ish-Hotel Dajtit në bulevard')[0].name).toBe('ish-Hotel Dajti (Bulevardi)');
  });
  it('detects denials', () => {
    expect(isDenial('Policia: Nuk është e vërtetë se...')).toBe(true);
    expect(isDenial('Lajm i rremë për mbylljen e shkollave')).toBe(true);
    expect(isDenial('Protesta vazhdon')).toBe(false);
  });
});
