export default function RedirectingAshaSathi() {
  return (
    <>
<div className="ambient-blob bg-primary-container w-[40vw] h-[40vw] -top-[10vw] -left-[10vw]"></div><div className="ambient-blob bg-tertiary-container w-[30vw] h-[30vw] bottom-[5vw] right-[5vw]" style={{ animationDelay: '-5s' }}></div>
<main className="bg-surface/80 backdrop-blur-xl border border-outline-variant/30 rounded-xl shadow-xl w-full max-w-md p-lg md:p-xl flex flex-col items-center relative z-10 text-center pulse-subtle">
<header className="mb-xl flex flex-col items-center"><span className="material-symbols-outlined text-primary-container text-[48px] mb-sm" style={{ fontVariationSettings: '\'FILL\' 1' }}>
                health_and_safety
            </span><h1 className="font-display-lg text-display-lg text-primary">ASHA Sathi</h1><div className="h-px w-16 bg-outline-variant mt-sm"></div></header>
<div className="relative flex items-center justify-center mb-lg"><div className="loader-ring"></div><span className="material-symbols-outlined absolute text-on-surface text-[32px] opacity-70">
                admin_panel_settings
            </span></div>
<h2 className="font-headline-md text-headline-md text-on-surface mb-xs transition-opacity duration-300" id="status-title">Authenticating Identity</h2><p className="font-body-md text-body-md text-on-surface-variant max-w-[280px]" id="status-desc">Verifying credentials and preparing your secure workspace...</p>
<div className="grid grid-cols-3 gap-sm w-full mt-xl">
<div className="flex flex-col items-center justify-center p-sm rounded-lg bg-surface-container border border-outline-variant/50 transition-all duration-300 opacity-40 grayscale" id="role-admin"><span className="material-symbols-outlined text-on-surface-variant mb-xs" style={{ fontVariationSettings: '\'FILL\' 0' }}>
                    account_balance
                </span><span className="font-label-md text-label-md text-on-surface-variant">Admin</span></div>
<div className="flex flex-col items-center justify-center p-sm rounded-lg bg-surface-container border border-outline-variant/50 transition-all duration-300 opacity-40 grayscale" id="role-asha"><span className="material-symbols-outlined text-on-surface-variant mb-xs" style={{ fontVariationSettings: '\'FILL\' 0' }}>
                    medical_services
                </span><span className="font-label-md text-label-md text-on-surface-variant">ASHA</span></div>
<div className="flex flex-col items-center justify-center p-sm rounded-lg bg-surface-container border border-outline-variant/50 transition-all duration-300 opacity-40 grayscale" id="role-patient"><span className="material-symbols-outlined text-on-surface-variant mb-xs" style={{ fontVariationSettings: '\'FILL\' 0' }}>
                    family_restroom
                </span><span className="font-label-md text-label-md text-on-surface-variant">Patient</span></div></div></main>
    </>
  )
}
