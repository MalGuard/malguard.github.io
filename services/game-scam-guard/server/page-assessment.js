// Use the same evidence policy for the submitted page and every linked page.
// Provider failures are coverage gaps; neither missing data nor an absent report
// establishes safety. Signals describe observed evidence, never brand trust.
export function assessPage({signals = [], redirects = [], reputation, finalReputation, statusOverride}) {
  const findings = [...signals];
  if ([reputation?.status, finalReputation?.status].includes('listed')) {
    findings.unshift({level:'danger',rule:'urlhaus_report',title:'لینک در پایگاه تهدید گزارش شده',detail:'URLhaus برای لینک اولیه یا مقصد نهایی گزارش تهدید دارد. از دانلود و پرداخت خودداری کنید.'});
  }
  if (redirects.some(item => new URL(item.from).hostname !== new URL(item.to).hostname)) {
    findings.push({level:'warning',rule:'cross_domain_redirect',title:'انتقال به دامنهٔ دیگر',detail:'لینک به یک دامنهٔ دیگر منتقل شد. آدرس نهایی را پیش از خرید کنترل کنید.'});
  }
  const status = findings.some(item => item.level === 'danger') ? 'danger'
    : statusOverride || (findings.some(item => item.level === 'warning') ? 'warning' : 'limited');
  return {signals:findings, status};
}
