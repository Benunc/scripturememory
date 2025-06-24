// Profanity filter utility
// This is a basic implementation - you may want to expand this list based on your needs

const PROFANITY_WORDS = new Set([
    // General Profanity
    'fuck', 'f*ck', 'f**k', 'f***', 'f u c k', 'f.u.c.k', 'f_u_c_k', 'fux', 'phuck', 'fuk', 'f0ck',
    'shit', 'sh*t', 's***', 's h i t', 's.h.i.t', 's_h_i_t', 'sh1t', '5hit', 'shyt',
    'ass', 'a**', 'a***', 'a s s', 'a.s.s', 'a_s_s', 'a55', '4ss', 'azz',
    'bitch', 'b*tch', 'b**ch', 'b i t c h', 'b.i.t.c.h', 'b_i_t_c_h', 'b1tch', 'biatch',
    'cunt', 'c*nt', 'c**nt', 'c u n t', 'c.u.n.t', 'c_u_n_t', 'kunt',
    'dick', 'd*ck', 'd**ck', 'd i c k', 'd.i.c.k', 'd_i_c_k', 'd1ck', 'dik',
    'piss', 'p*ss', 'p**ss', 'p i s s', 'p.i.s.s', 'p_i_s_s', 'pi55',
    'cock', 'c*ck', 'c**ck', 'c o c k', 'c.o.c.k', 'c_o_c_k', 'c0ck', 'kock',
    'pussy', 'p*ssy', 'p**sy', 'p u s s y', 'p.u.s.s.y', 'p_u_s_s_y', 'pu55y', 'puss1',
    'whore', 'wh*re', 'w**re', 'w h o r e', 'w.h.o.r.e', 'w_h_o_r_e', 'wh0re', 'h0re',
    'bastard', 'b*stard', 'b**stard', 'b a s t a r d', 'b.a.s.t.a.r.d', 'b_a_s_t_a_r_d',
    'damn', 'd*mn', 'd**mn', 'd a m n', 'd.a.m.n', 'd_a_m_n',
    'hell', 'h*ll', 'h**ll', 'h e l l', 'h.e.l.l', 'h_e_l_l',
    'prick', 'p*rck', 'p**ck', 'p r i c k', 'p.r.i.c.k', 'p_r_i_c_k',
    'twat', 't*wat', 't**at', 't w a t', 't.w.a.t', 't_w_a_t',
    'wanker', 'w*nker', 'w**nker', 'w a n k e r', 'w.a.n.k.e.r', 'w_a_n_k_e_r',
    'arse', 'a*rse', 'a**se', 'a r s e', 'a.r.s.e', 'a_r_s_e', 'ar5e',
    'bollock', 'b*llock', 'b**llock', 'b o l l o c k', 'b.o.l.l.o.c.k', 'b_o_l_l_o_c_k',
  
    // Sexual/Slur Terms
    'faggot', 'f*ggot', 'f**got', 'f a g g o t', 'f.a.g.g.o.t', 'f_a_g_g_o_t', 'fag',
    'dyke', 'd*ke', 'd**ke', 'd y k e', 'd.y.k.e', 'd_y_k_e',
    'slut', 's*ut', 's**ut', 's l u t', 's.l.u.t', 's_l_u_t',
    'skank', 'sk*nk', 'sk**nk', 's k a n k', 's.k.a.n.k', 's_k_a_n_k',
    'ho', 'h*', 'h**', 'h o', 'h.o', 'h_o', 'h0',
    'douche', 'd*uche', 'd**che', 'd o u c h e', 'd.o.u.c.h.e', 'd_o_u_c_h_e',
    'cum', 'c*m', 'c**m', 'c u m', 'c.u.m', 'c_u_m',
    'jizz', 'j*zz', 'j**zz', 'j i z z', 'j.i.z.z', 'j_i_z_z',
    'semen', 's*men', 's**men', 's e m e n', 's.e.m.e.n', 's_e_m_e_n',
  
    // Racial/Ethnic Slurs
    'nigger', 'n*gger', 'n**ger', 'n i g g e r', 'n.i.g.g.e.r', 'n_i_g_g_e_r', 'n1gger', 'nigga',
    'chink', 'ch*nk', 'ch**nk', 'c h i n k', 'c.h.i.n.k', 'c_h_i_n_k', 'ch1nk',
    'spic', 'sp*c', 'sp**c', 's p i c', 's.p.i.c', 's_p_i_c', 'sp1c',
    'kike', 'k*ke', 'k**ke', 'k i k e', 'k.i.k.e', 'k_i_k_e', 'k1ke',
    'wetback', 'w*tback', 'w**tback', 'w e t b a c k', 'w.e.t.b.a.c.k', 'w_e_t_b_a_c_k',
    'coon', 'c*on', 'c**on', 'c o o n', 'c.o.o.n', 'c_o_o_n',
    'gook', 'g*ok', 'g**ok', 'g o o k', 'g.o.o.k', 'g_o_o_k',
    'jap', 'j*p', 'j**p', 'j a p', 'j.a.p', 'j_a_p',
    'cracker', 'cr*cker', 'cr**cker', 'c r a c k e r', 'c.r.a.c.k.e.r', 'c_r_a_c_k_e_r',
    'redneck', 'r*dneck', 'r**dneck', 'r e d n e c k', 'r.e.d.n.e.c.k', 'r_e_d_n_e_c_k',
    'hick', 'h*ck', 'h**ck', 'h i c k', 'h.i.c.k', 'h_i_c_k',
  
    // Ableist/Insulting Terms
    'retard', 'r*tard', 'r**tard', 'r e t a r d', 'r.e.t.a.r.d', 'r_e_t_a_r_d',
    'moron', 'm*ron', 'm**ron', 'm o r o n', 'm.o.r.o.n', 'm_o_r_o_n',
    'idiot', 'id*ot', 'id**ot', 'i d i o t', 'i.d.i.o.t', 'i_d_i_o_t',
    'dumb', 'd*mb', 'd**mb', 'd u m b', 'd.u.m.b', 'd_u_m_b',
    'stupid', 'st*pid', 'st**pid', 's t u p i d', 's.t.u.p.i.d', 's_t_u_p_i_d',
    'lame', 'l*me', 'l**me', 'l a m e', 'l.a.m.e', 'l_a_m_e',
    'freak', 'fr*ak', 'fr**ak', 'f r e a k', 'f.r.e.a.k', 'f_r_e_a_k',
    'dork', 'd*rk', 'd**rk', 'd o r k', 'd.o.r.k', 'd_o_r_k',
    'spazz', 'sp*zz', 'sp**zz', 's p a z z', 's.p.a.z.z', 's_p_a_z_z',
    'cripple', 'cr*pple', 'cr**pple', 'c r i p p l e', 'c.r.i.p.p.l.e', 'c_r_i_p_p_l_e',
    'midget', 'm*dget', 'm**dget', 'm i d g e t', 'm.i.d.g.e.t', 'm_i_d_g_e_t',
    'psycho', 'ps*cho', 'ps**cho', 'p s y c h o', 'p.s.y.c.h.o', 'p_s_y_c_h_o',
    'schizo', 'sch*zo', 'sch**zo', 's c h i z o', 's.c.h.i.z.o', 's_c_h_i_z_o',
  
    // Other Offensive Terms
    'tranny', 'tr*nny', 'tr**nny', 't r a n n y', 't.r.a.n.n.y', 't_r_a_n_n_y',
    'nazi', 'n*zi', 'n**zi', 'n a z i', 'n.a.z.i', 'n_a_z_i',
    'kkk', 'k*k', 'k**k', 'k k k', 'k.k.k', 'k_k_k',
    'pedophile', 'p*dophile', 'p**dophile', 'p e d o p h i l e', 'p.e.d.o.p.h.i.l.e', 'p_e_d_o_p_h_i_l_e',
    'rape', 'r*pe', 'r**pe', 'r a p e', 'r.a.p.e', 'r_a_p_e',
    'terrorist', 't*rrorist', 't**rrorist', 't e r r o r i s t', 't.e.r.r.o.r.i.s.t', 't_e_r_r_o_r_i_s_t',
  
    // Common Abbreviations/Slang
    'wtf', 'w*t*f', 'w**f', 'w t f', 'w.t.f', 'w_t_f',
    'stfu', 's*t*f*u', 's**f*u', 's t f u', 's.t.f.u', 's_t_f_u',
    'gtfo', 'g*t*f*o', 'g**f*o', 'g t f o', 'g.t.f.o', 'g_t_f_o',
    'fml', 'f*m*l', 'f**l', 'f m l', 'f.m.l', 'f_m_l',
  ]);

// Common words that might be flagged but are actually okay
const ALLOWED_WORDS = new Set([
  'assume', 'assumption', 'assassin', 'assembly', 'assess', 'asset', 'assist',
  'butcher', 'butter', 'button', 'butterfly',
  'classic', 'classical', 'classification',
  'grass', 'pass', 'glass', 'mass', 'assemble',
  'hello', 'help', 'helpful',
  'damnation', 'damned', 'damning',
  'gods', 'goddess', 'godly', 'godliness',
  'christian', 'christmas',
]);

/**
 * Check if text contains profanity
 * @param text - The text to check
 * @returns true if profanity is detected, false otherwise
 */
export const containsProfanity = (text: string): boolean => {
  if (!text || typeof text !== 'string') return false;
  
  // Convert to lowercase and split into words
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
    .split(/\s+/)
    .filter(word => word.length > 0);
  
  return words.some(word => {
    // Check if word is in profanity list but not in allowed words
    return PROFANITY_WORDS.has(word) && !ALLOWED_WORDS.has(word);
  });
};

/**
 * Get a user-friendly error message for profanity detection
 * @param fieldName - The name of the field that contains profanity
 * @returns A user-friendly error message
 */
export const getProfanityErrorMessage = (fieldName: string): string => {
  return `${fieldName} contains inappropriate language. Please choose different words.`;
};

/**
 * Check multiple fields for profanity
 * @param fields - Object with field names and their values
 * @returns Object with field names and error messages (if any)
 */
export const validateFieldsForProfanity = (fields: Record<string, string>): Record<string, string> => {
  const errors: Record<string, string> = {};
  
  Object.entries(fields).forEach(([fieldName, value]) => {
    if (value && containsProfanity(value)) {
      errors[fieldName] = getProfanityErrorMessage(fieldName);
    }
  });
  
  return errors;
}; 