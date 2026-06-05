// src/hooks/use-ddragon.ts
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useEffect, useState } from 'react';

type ChampEntry = {
  key: string;   // id numérico como string (p.ej. "80")
  id: string;    // slug (p.ej. "Pantheon")
  name: string;  // nombre localizado
  image: string; // URL a la imagen de icono
};

type ChampMaps = {
  version: string;
  byKey: Record<string, ChampEntry>; // por key numérica
  byId: Record<string, ChampEntry>;  // por slug
};

export function useChampions() {
  return useQuery<ChampMaps>({
    queryKey: ["ddragon", "champions"],
    queryFn: async () => {
      // 1) última versión
      const { data: versions } = await axios.get<string[]>(
        "https://ddragon.leagueoflegends.com/api/versions.json"
      );
      const version = versions[0];

      // 2) champion.json en español (usa es_MX para LATAM)
      const { data } = await axios.get(
        `https://ddragon.leagueoflegends.com/cdn/${version}/data/es_MX/champion.json`
      );

      const champs = data.data as Record<string, any>;
      const byKey: ChampMaps["byKey"] = {};
      const byId: ChampMaps["byId"] = {};

      Object.values(champs).forEach((c: any) => {
        const entry: ChampEntry = {
          key: c.key,            // numérico en string
          id: c.id,              // slug
          name: c.name,          // nombre localizado
          image: `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${c.id}.png`,
        };
        byKey[c.key] = entry;
        byId[c.id] = entry;
      });

      return { version, byKey, byId };
    },
    staleTime: 24 * 60 * 60 * 1000, // 24h
    gcTime: 7 * 24 * 60 * 60 * 1000, // cache 7d
  });
}

export function useStaticData() {
  const [version, setVersion] = useState<string>();
  const [items, setItems] = useState<Record<string, {name:string, desc:string, icon:string}>>({});
  const [spells, setSpells] = useState<Record<string, {name:string, desc:string, icon:string}>>({});
  const [runes, setRunes] = useState<Record<number, {name:string, icon:string}>>({});
  const [augments, setAugments] = useState<Record<number, {name:string, icon:string}>>({}); // Arena

  useEffect(() => {
    (async () => {
      // 1) version
      const vs = await fetch('https://ddragon.leagueoflegends.com/api/versions.json').then(r=>r.json());
      const v = vs?.[0]; setVersion(v);

      // 2) items
      const it = await fetch(`https://ddragon.leagueoflegends.com/cdn/${v}/data/en_US/item.json`).then(r=>r.json());
      const itemsMap: Record<string, any> = {};
      Object.entries<any>(it.data).forEach(([id, d]) => {
        itemsMap[id] = {
          name: d.name,
          desc: d.plaintext || d.description || '',
          icon: `https://ddragon.leagueoflegends.com/cdn/${v}/img/item/${id}.png`
        };
      });
      setItems(itemsMap);

      // 3) spells
      const sp = await fetch(`https://ddragon.leagueoflegends.com/cdn/${v}/data/en_US/summoner.json`).then(r=>r.json());
      const spellsMap: Record<string, any> = {};
      Object.values<any>(sp.data).forEach(d => {
        spellsMap[String(d.key)] = {
          name: d.name,
          desc: d.description || '',
          icon: `https://ddragon.leagueoflegends.com/cdn/${v}/img/spell/${d.id}.png`
        };
      });
      setSpells(spellsMap);

      // 4) runes (keystone + paths)
      const rn = await fetch(`https://ddragon.leagueoflegends.com/cdn/${v}/data/en_US/runesReforged.json`).then(r=>r.json());
      const runesMap: Record<number, any> = {};
      rn.forEach((tree:any) => {
        runesMap[tree.id] = { name: tree.name, icon: `https://ddragon.leagueoflegends.com/cdn/img/${tree.icon}` };
        tree.slots.forEach((slot:any) => slot.runes.forEach((r:any) => {
          runesMap[r.id] = { name: r.name, icon: `https://ddragon.leagueoflegends.com/cdn/img/${r.icon}` };
        }));
      });
      setRunes(runesMap);

      // 5) Arena augments (CDragon)
      // Nota: CDragon mantiene IDs consistentes. Si algún ID falta, muéstralo como texto.
      const ag = await fetch('/api/static/arena-augments').then(r=>r.json());
const augMap: Record<number, any> = {};
ag?.augments?.forEach((a:any) => {
  // estructura típica: { id, name, iconPath, ... }
  augMap[a.id] = {
    name: a.name,
    icon: a.iconPath
      ? `https://raw.communitydragon.org/latest/game/${a.iconPath.toLowerCase()}`
      : undefined
  };
});
setAugments(augMap);
    })();
  }, []);

  return { version, items, spells, runes, augments };
}
