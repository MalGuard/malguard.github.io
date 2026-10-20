// Use the same evidence policy for the submitted page and every linked page.
// Provider failures are coverage gaps; neither missing data nor an absent report
// establishes safety. Signals describe observed evidence, never brand trust.
export function assessPage({signals = [], redirects = [], reputation, finalReputation, statusOverride,analysisEngine}) {
  const findings = [...signals];
  if ([reputation?.status, finalReputation?.status].includes('listed')) {
    findings.unshift({level:'danger',rule:'urlhaus_report',title:'لینک در پایگاه تهدید گزارش شده',detail:'برای لینک اولیه یا مقصد نهایی، منبع اطلاعات تهدید گزارش دارد. از دانلود و پرداخت خودداری کنید.'});
  }
  if (redirects.some(item => new URL(item.from).hostname !== new URL(item.to).hostname)) {
    findings.push({level:'warning',rule:'cross_domain_redirect',title:'انتقال به دامنهٔ دیگر',detail:'لینک به یک دامنهٔ دیگر منتقل شد. آدرس نهایی را پیش از خرید کنترل کنید.'});
  }
  const sourceResults=[reputation,finalReputation].filter(Boolean).flatMap(item=>item.sources||[item]);
  const configuredSources=sourceResults.filter(item=>item.status!=='unconfigured');
  const missingThreatEvidence=sourceResults.length>0&&(!configuredSources.length||configuredSources.some(item=>!['listed','not_found'].includes(item.status)));
  const status = findings.some(item => item.level === 'danger') ? 'danger'
    : statusOverride || (findings.some(item => item.level === 'warning') ? 'warning' : missingThreatEvidence||analysisEngine?.modules?.some(item=>item.status==='incomplete'||item.coverage==='limited')?'unavailable':'limited');
  return {signals:findings, status};
}
