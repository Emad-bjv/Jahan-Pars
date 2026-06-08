import jalaali from 'jalaali-js';

export function j2g(jy, jm, jd) {
  return jalaali.toGregorian(jy, jm, jd);
}

export function g2j(gy, gm, gd) {
  return jalaali.toJalaali(gy, gm, gd);
}

export function jDaysInMonth(jy, jm) {
  return jalaali.jalaaliMonthLength(jy, jm);
}
