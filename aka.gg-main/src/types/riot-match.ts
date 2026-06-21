// TypeScript interfaces for Riot Games Match-V5 API (MatchDto and all sub-objects)

export interface MatchDto {
  metadata: MetadataDto;
  info: InfoDto;
}

export interface MetadataDto {
  dataVersion: string;
  matchId: string;
  participants: string[];
}

export interface InfoDto {
  endOfGameResult: string;
  gameCreation: number;
  gameDuration: number;
  gameEndTimestamp?: number;
  gameId: number;
  gameMode: string;
  gameName: string;
  gameStartTimestamp: number;
  gameType: string;
  gameVersion: string;
  mapId: number;
  participants: ParticipantDto[];
  platformId: string;
  queueId: number;
  teams: TeamDto[];
  tournamentCode?: string;
}

export interface ParticipantDto {
  allInPings: number;
  assistMePings: number;
  assists: number;
  baronKills: number;
  bountyLevel: number;
  champExperience: number;
  champLevel: number;
  championId: number;
  championName: string;
  championTransform: number;
  commandPings: number;
  consumablesPurchased: number;
  challenges?: ChallengesDto;
  damageDealtToBuildings: number;
  damageDealtToObjectives: number;
  damageDealtToTurrets: number;
  damageSelfMitigated: number;
  deaths: number;
  detectorWardsPlaced: number;
  doubleKills: number;
  dragonKills: number;
  eligibleForProgression: boolean;
  enemyMissingPings: number;
  enemyVisionPings: number;
  firstBloodAssist: boolean;
  firstBloodKill: boolean;
  firstTowerAssist: boolean;
  firstTowerKill: boolean;
  gameEndedInEarlySurrender: boolean;
  gameEndedInSurrender: boolean;
  holdPings: number;
  getBackPings: number;
  goldEarned: number;
  goldSpent: number;
  individualPosition: string;
  inhibitorKills: number;
  inhibitorTakedowns: number;
  inhibitorsLost: number;
  item0: number;
  item1: number;
  item2: number;
  item3: number;
  item4: number;
  item5: number;
  item6: number;
  itemsPurchased: number;
  killingSprees: number;
  kills: number;
  lane: string;
  largestCriticalStrike: number;
  largestKillingSpree: number;
  largestMultiKill: number;
  longestTimeSpentLiving: number;
  magicDamageDealt: number;
  magicDamageDealtToChampions: number;
  magicDamageTaken: number;
  missions?: MissionsDto;
  needVisionPings: number;
  neutralMinionsKilled: number;
  nexusKills: number;
  nexusLost: number;
  nexusTakedowns: number;
  objectivesStolen: number;
  objectivesStolenAssists: number;
  onMyWayPings: number;
  participantId: number;
  pentaKills: number;
  perks?: PerksDto;
  physicalDamageDealt: number;
  physicalDamageDealtToChampions: number;
  physicalDamageTaken: number;
  placement: number;
  playerAugment1?: number;
  playerAugment2?: number;
  playerAugment3?: number;
  playerAugment4?: number;
  playerScore0?: number;
  playerScore1?: number;
  playerScore2?: number;
  playerScore3?: number;
  playerScore4?: number;
  playerScore5?: number;
  playerScore6?: number;
  playerScore7?: number;
  playerScore8?: number;
  playerScore9?: number;
  playerScore10?: number;
  playerScore11?: number;
  playerSubteamId?: number;
  profileIcon: number;
  puuid: string;
  quadraKills: number;
  riotIdGameName: string;
  riotIdTagline: string;
  role: string;
  sightWardsBoughtInGame: number;
  spell1Casts: number;
  spell2Casts: number;
  spell3Casts: number;
  spell4Casts: number;
  subteamPlacement?: number;
  summoner1Casts: number;
  summoner1Id: number;
  summoner2Casts: number;
  summoner2Id: number;
  summonerId: string;
  summonerLevel: number;
  summonerName: string;
  teamEarlySurrendered: boolean;
  teamId: number;
  teamPosition: string;
  timeCCingOthers: number;
  timePlayed: number;
  totalAllyJungleMinionsKilled: number;
  totalDamageDealt: number;
  totalDamageDealtToChampions: number;
  totalDamageShieldedOnTeammates: number;
  totalDamageTaken: number;
  totalEnemyJungleMinionsKilled: number;
  totalHeal: number;
  totalHealsOnTeammates: number;
  totalMinionsKilled: number;
  totalTimeCCDealt: number;
  totalTimeSpentDead: number;
  totalUnitsHealed: number;
  tripleKills: number;
  trueDamageDealt: number;
  trueDamageDealtToChampions: number;
  trueDamageTaken: number;
  turretKills: number;
  turretTakedowns: number;
  turretsLost: number;
  unrealKills: number;
  visionClearedPings: number;
  visionScore: number;
  visionWardsBoughtInGame: number;
  wardsKilled: number;
  wardsPlaced: number;
  win: boolean;
}

export interface ChallengesDto {
  "12AssistStreakCount"?: number;
  abilityUses?: number;
  acesBefore15Minutes?: number;
  alliedJungleMonsterKills?: number;
  baronBuffGoldAdvantageOverThreshold?: number;
  baronTakedowns?: number;
  blastConeOppositeOpponentCount?: number;
  bountyGold?: number;
  buffsStolen?: number;
  completeSupportQuestInTime?: number;
  controlWardTimeCoverageInRiverOrEnemyHalf?: number;
  controlWardsPlaced?: number;
  damagePerMinute?: number;
  damageTakenOnTeamPercentage?: number;
  dancedWithRiftHerald?: number;
  deathsByEnemyChamps?: number;
  dodgeSkillShotsSmallWindow?: number;
  doubleAces?: number;
  dragonTakedowns?: number;
  earliestBaron?: number;
  earliestDragonTakedown?: number;
  earliestElderDragon?: number;
  earlyLaningPhaseGoldExpAdvantage?: number;
  effectiveHealAndShielding?: number;
  elderDragonKillsWithOpposingSoul?: number;
  elderDragonMultikills?: number;
  enemyChampionImmobilizations?: number;
  enemyJungleMonsterKills?: number;
  epicMonsterKillsNearEnemyJungler?: number;
  epicMonsterKillsWithin30SecondsOfSpawn?: number;
  epicMonsterSteals?: number;
  epicMonsterStolenWithoutSmite?: number;
  fasterSupportQuestCompletion?: number;
  fastestLegendary?: number;
  firstTurretKilled?: number;
  firstTurretKilledTime?: number;
  flawlessAces?: number;
  fullTeamTakedown?: number;
  gameLength?: number;
  getTakedownsInAllLanesEarlyJungleAsLaner?: number;
  goldPerMinute?: number;
  hadAfkTeammate?: number;
  hadOpenNexus?: number;
  highestChampionDamage?: number;
  highestCrowdControlScore?: number;
  highestWardKills?: number;
  immobilizeAndKillWithAlly?: number;
  initialBuffCount?: number;
  initialCrabCount?: number;
  jungleCsBefore10Minutes?: number;
  junglerTakedownsNearDamagedEpicMonster?: number;
  kTurretsDestroyedBeforePlatesFall?: number;
  kda?: number;
  killAfterHiddenWithAlly?: number;
  killParticipation?: number;
  killsNearEnemyTurret?: number;
  killsOnLanersEarlyJungleAsJungler?: number;
  killsOnOtherLanesEarlyJungleAsLaner?: number;
  killsOnRecentlyHealedByAramPack?: number;
  killsUnderOwnTurret?: number;
  killedChampTookFullTeamDamageSurvived?: number;
  killingSprees?: number;
  knockEnemyIntoTeamAndKill?: number;
  landSkillShotsEarlyGame?: number;
  laneMinionsFirst10Minutes?: number;
  laningPhaseGoldExpAdvantage?: number;
  legendaryCount?: number;
  legendaryItemUsed?: number[];
  lostAnInhibitor?: number;
  maxCsAdvantageOnLaneOpponent?: number;
  maxKillDeficit?: number;
  maxLevelLeadLaneOpponent?: number;
  mejaisFullStackInTime?: number;
  moreEnemyJungleThanOpponent?: number;
  mostWardsDestroyedOneSweeper?: number;
  multiKillOneSpell?: number;
  multiTurretRiftHeraldCount?: number;
  multikills?: number;
  multikillsAfterAggressiveFlash?: number;
  mythicItemUsed?: number;
  outnumberedKills?: number;
  outnumberedNexusKill?: number;
  perfectDragonSoulsTaken?: number;
  perfectGame?: number;
  pickKillWithAlly?: number;
  playedChampSelectPosition?: number;
  poroExplosions?: number;
  quickCleanse?: number;
  quickFirstTurret?: number;
  quickSoloKills?: number;
  riftHeraldTakedowns?: number;
  saveAllyFromDeath?: number;
  scuttleCrabKills?: number;
  shortestTimeToAceFromFirstTakedown?: number;
  skillshotsDodged?: number;
  skillshotsHit?: number;
  snowballsHit?: number;
  soloBaronKills?: number;
  soloKills?: number;
  soloTurretsLategame?: number;
  stealthWardsPlaced?: number;
  survivedSingleDigitHpCount?: number;
  survivedThreeImmobilizesInFight?: number;
  takedownOnFirstTurret?: number;
  takedowns?: number;
  takedownsAfterGainingLevelAdvantage?: number;
  takedownsBeforeJungleMinionSpawn?: number;
  takedownsFirstXMinutes?: number;
  takedownsInAlcoveInEnemyFountain?: number;
  teamBaronKills?: number;
  teamDamagePercentage?: number;
  teamElderDragonKills?: number;
  teamRiftHeraldKills?: number;
  teleportTakedowns?: number;
  threeWardsOneSweeperCount?: number;
  tookLargeDamageSurvived?: number;
  turretPlatesTaken?: number;
  turretTakedowns?: number;
  turretsTakenWithRiftHerald?: number;
  twentyMinionsIn3SecondsCount?: number;
  twoWardsOneSweeperCount?: number;
  unseenRecalls?: number;
  visionScoreAdvantageLaneOpponent?: number;
  visionScorePerMinute?: number;
  wardsGuarded?: number;
  wardTakedowns?: number;
  wardTakedownsBefore20M?: number;
}

export interface MissionsDto {
  playerScore0?: number;
  playerScore1?: number;
  playerScore2?: number;
  playerScore3?: number;
  playerScore4?: number;
  playerScore5?: number;
  playerScore6?: number;
  playerScore7?: number;
  playerScore8?: number;
  playerScore9?: number;
  playerScore10?: number;
  playerScore11?: number;
}

export interface PerksDto {
  statPerks: PerkStatsDto;
  styles: PerkStyleDto[];
}

export interface PerkStatsDto {
  defense: number;
  flex: number;
  offense: number;
}

export interface PerkStyleDto {
  description: string;
  selections: PerkStyleSelectionDto[];
  style: number;
}

export interface PerkStyleSelectionDto {
  perk: number;
  var1: number;
  var2: number;
  var3: number;
}

export interface TeamDto {
  bans: BanDto[];
  objectives: ObjectivesDto;
  teamId: number;
  win: boolean;
}

export interface BanDto {
  championId: number;
  pickTurn: number;
}

export interface ObjectivesDto {
  baron: ObjectiveDto;
  champion: ObjectiveDto;
  dragon: ObjectiveDto;
  horde?: ObjectiveDto;
  inhibitor: ObjectiveDto;
  riftHerald: ObjectiveDto;
  tower: ObjectiveDto;
}

export interface ObjectiveDto {
  first: boolean;
  kills: number;
}

// ─── Parsed stats shape returned by our backend ──────────────────────────────

export interface ParticipantStats {
  summonerName: string;
  tagLine: string;
  championName: string;
  champLevel: number;
  teamId: number;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  kda: number;
  cs: number;
  csPerMin: number;
  goldEarned: number;
  totalDamageDealt: number;
  physicalDamage: number;
  magicDamage: number;
  trueDamage: number;
  damageTaken: number;
  healingDone: number;
  visionScore: number;
  wardsPlaced: number;
  wardsKilled: number;
  items: number[];
  summoner1Id: number;
  summoner2Id: number;
  perks: { keystoneId: number; secondaryStyleId: number };
  pentaKills: number;
  quadraKills: number;
  tripleKills: number;
  doubleKills: number;
  firstBloodKill: boolean;
  teamPosition: string;
  largestMultiKill: number;
  killingSprees: number;
  totalTimeCCDealt: number;
  challenges?: Partial<ChallengesDto>;
}

export interface TeamObjectives {
  win: boolean;
  bans: BanDto[];
  baronKills: number;
  dragonKills: number;
  towerKills: number;
  inhibitorKills: number;
  riftHeraldKills: number;
  firstBaron: boolean;
  firstDragon: boolean;
  firstTower: boolean;
}

export interface MatchStatsResponse {
  matchId: string;
  gameDuration: number;
  gameStartTimestamp: number;
  gameEndTimestamp?: number;
  gameMode: string;
  isComplete: boolean;
  winner: 'blue' | 'red' | null;
  blueTeam: ParticipantStats[];
  redTeam: ParticipantStats[];
  blueObjectives: TeamObjectives;
  redObjectives: TeamObjectives;
}
