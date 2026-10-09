// Уверенность вывода по трем источникам (ТЗ v2.1, раздел 2): S = 0.50·опыт + 0.35·исследования + 0.15·замер.
// Опыт задает специалист (доля его клиентов, у которых он видит этот признак); пока не задан, считается 0 и вывод помечается.
// Безопасность не взвешивается: стоп-флаги стоят выше любых баллов. Уверенность ложится меткой поверх тона, тон не меняет.
export const WEIGHTS = { experience: .50, research: .35, data: .15 };
export const BANDS = { low: .40, high: .70 };
export const CALIBRATED = false, DATA_CAP = .5; // до проверки повторяемости на 20–30 людях замер весит не больше половины

/** Реестр исследований: e_res по признакам приложения. Источник оценки — ТЗ v2.1 (R1, R2, R4, R5, R6); остального в реестре нет (0). */
export const RESEARCH = {
  knee_valgus: [.70, 'Neal 2019 (E1), Macrum 2012 (E2)'], sls_valgus_r: [.70, 'Neal 2019 (E1), Macrum 2012 (E2)'], sls_valgus_l: [.70, 'Neal 2019 (E1), Macrum 2012 (E2)'],
  sq_heel: [.70, 'метаанализ тыльного сгибания (E1)'], head_forward: [.30, 'Castelein 2016 (E2), BMC 2025 (E1, очень низкая уверенность)'],
  oh_reach: [.40, 'Ulug 2025 (E2), Procópio 2025 (E2)'], sq_arms: [.40, 'Ulug 2025 (E2), Procópio 2025 (E2)'], sq_lean: [.40, 'Choi 2022 (E2), Malai 2015 (E2)'],
  pelvis_tilt: [0, 'только пилотное исследование (PMC2744922)'],
};
export const RULE_NAMES = {
  pelvis_tilt: 'Перекос таза в стойке', shoulder_tilt: 'Перекос плеч', head_forward: 'Голова вынесена вперед', head_tilt: 'Наклон головы', trunk_shift: 'Корпус смещен в сторону',
  knee_hyper: 'Переразгибание колен', trunk_back: 'Корпус отклонен назад', knee_valgus: 'Колено внутрь в приседе', sq_shift: 'Таз уходит в сторону в приседе', foot_out: 'Стопы разворачиваются наружу',
  sq_lean: 'Сильный наклон корпуса в приседе', sq_arms: 'Руки падают вперед в приседе', sq_heel: 'Пятки отрываются', sq_pelvis: 'Перекос таза в приседе',
  sls_valgus_r: 'Колено внутрь на правой ноге', sls_drop_r: 'Провал таза на правой ноге', sls_trunk_r: 'Наклон корпуса на правой ноге',
  sls_valgus_l: 'Колено внутрь на левой ноге', sls_drop_l: 'Провал таза на левой ноге', sls_trunk_l: 'Наклон корпуса на левой ноге',
  elbow_bend_r: 'Правый локоть сгибается над головой', elbow_bend_l: 'Левый локоть сгибается над головой', asym_delt: 'Разница рук в стороны', asym_bend: 'Разница наклонов',
  asym_calf: 'Разница икр', asym_quad: 'Разница глубины на одной ноге', sq_depth_low: 'Неглубокий присед', oh_reach: 'Руки не доходят до вертикали', hand_rot: 'Кисти развернуты внутрь',
  trunk_forward: 'Плечи впереди таза', hips_forward: 'Таз вынесен вперед', bend_low: 'Малая амплитуда наклонов',
};
export const LABELS = {
  NEEDS_SPECIALIST_INPUT: 'Нужна оценка специалиста', PRACTICE_ONLY_HYPOTHESIS: 'Гипотеза специалиста: в исследованиях не подтверждена',
  PRELIMINARY: 'Замер на границе нормы, предварительно', SPECIALIST_OVERRIDE: 'Исправлено специалистом', CHAIN: 'Вывод по цепи, напрямую не измерено',
};
export const BAND_NAMES = { LOW: 'низкая', MODERATE: 'средняя', HIGH: 'высокая' };
const band = S => S < BANDS.low ? 'LOW' : S < BANDS.high ? 'MODERATE' : 'HIGH';
const r3 = x => Math.round(x * 1000) / 1000;

/** Балл одного сработавшего признака. exp — опыт специалиста по этому признаку (0–1 или null). */
export function scoreRule(ruleId, borderline, exp) {
  const eExp = exp == null ? null : Math.max(0, Math.min(1, exp)), eRes = (RESEARCH[ruleId] || [0])[0], eData = Math.min(CALIBRATED ? 1 : DATA_CAP, borderline ? .5 : 1);
  const parts = { exp: r3(WEIGHTS.experience * (eExp ?? 0)), res: r3(WEIGHTS.research * eRes), data: r3(WEIGHTS.data * eData) };
  const S = r3(parts.exp + parts.res + parts.data), labels = [];
  if (eExp == null) labels.push('NEEDS_SPECIALIST_INPUT');
  if (eExp != null && eExp >= .5 && eRes < .2) labels.push('PRACTICE_ONLY_HYPOTHESIS');
  if (borderline) labels.push('PRELIMINARY');
  return { rule: ruleId, S, band: band(S), parts, eExp, eRes, eData, labels, source: (RESEARCH[ruleId] || [, 'в реестре нет'])[1] };
}
/** Уверенность по мышце на стороне: лучший из признаков, которые на нее указывают. Правка специалиста и вывод по цепи помечаются отдельно. */
export function scoreSpot(s, findings, profile = {}) {
  if (s.edited) return { S: null, band: null, labels: ['SPECIALIST_OVERRIDE'] };
  const fs = findings.filter(f => f.muscles.some(m => m.id === s.id && (m.side === s.side || m.side === 'BOTH')));
  if (!fs.length) return { S: null, band: null, labels: ['CHAIN'] };
  return fs.map(f => scoreRule(f.rule.id, f.borderline, profile[f.rule.id])).sort((a, b) => b.S - a.S)[0];
}
