export default function CheckUpCompletedAshaSathi() {
  return (
    <>
<main className="w-full max-w-md mx-auto p-lg flex flex-col h-full min-h-[884px] justify-between relative z-10">
<div className="flex flex-col items-center pt-xl pb-lg animate-pop-in"><div className="w-32 h-32 rounded-full bg-secondary-container flex items-center justify-center mb-md relative shadow-lg shadow-secondary-container/20">
<div className="absolute inset-0 rounded-full border-4 border-secondary-container opacity-30 scale-125"></div><div className="absolute inset-0 rounded-full border-2 border-secondary-container opacity-10 scale-150"></div><span className="material-symbols-outlined text-[72px] text-on-secondary-container" style={{ fontVariationSettings: '\'FILL\' 1' }}>
                    check_circle
                </span></div><h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface text-center mb-xs">
                Registration Complete
            </h1><p className="font-body-lg-mobile text-body-lg-mobile text-on-surface-variant text-center max-w-[280px]">
                Health check-up data has been successfully recorded.
            </p></div>
<div className="flex-1 flex flex-col gap-md w-full my-auto">
<div className="bg-error-container rounded-3xl p-md flex items-start gap-md border-l-4 border-error shadow-sm animate-slide-up delay-100"><div className="bg-error/10 rounded-full p-sm flex items-center justify-center shrink-0"><span className="material-symbols-outlined text-error text-[28px]" style={{ fontVariationSettings: '\'FILL\' 1' }}>
                        warning
                    </span></div><div className="flex-1 pt-1"><h2 className="font-label-md text-label-md text-on-error-container/80 uppercase tracking-widest mb-xs">
                        Risk Indicator
                    </h2><p className="font-headline-md text-headline-md text-on-error-container leading-tight">
                        High-Risk Pregnancy
                    </p><div className="mt-sm inline-flex items-center gap-xs bg-error/20 px-sm py-xs rounded-full"><span className="material-symbols-outlined text-on-error-container text-[16px]">
                            monitor_heart
                        </span><span className="font-caption text-caption text-on-error-container font-semibold">
                            Elevated Blood Pressure
                        </span></div></div></div>
<div className="grid grid-cols-2 gap-md">
<div className="bg-surface-container-high rounded-3xl p-md flex flex-col items-center justify-center text-center shadow-sm animate-slide-up delay-200"><div className="bg-primary-container/20 rounded-full p-sm mb-sm"><span className="material-symbols-outlined text-primary text-[28px]">
                            calendar_month
                        </span></div><h3 className="font-label-md text-label-md text-on-surface-variant mb-xs">Next Visit</h3><p className="font-headline-md text-headline-md text-on-surface text-[22px]">
                        Oct 24
                    </p></div>
<div className="bg-surface-container rounded-3xl p-md flex flex-col items-center justify-center text-center shadow-sm border border-outline-variant/30 relative animate-slide-up delay-300">
<div className="absolute top-md right-md w-3 h-3 rounded-full bg-outline shadow-sm"></div><div className="bg-surface-variant/50 rounded-full p-sm mb-sm"><span className="material-symbols-outlined text-on-surface-variant text-[28px]">
                            cloud_off
                        </span></div><h3 className="font-label-md text-label-md text-on-surface-variant mb-xs">Data Status</h3><p className="font-label-md text-label-md text-on-surface">
                        Stored Locally
                    </p><p className="font-caption text-caption text-on-surface-variant mt-xs">
                        Pending Sync
                    </p></div></div></div>
<div className="w-full flex flex-col gap-sm mt-xl pb-md animate-slide-up delay-300"><button className="w-full h-touch-target bg-primary text-on-primary font-label-md text-label-md rounded-full shadow-md flex items-center justify-center gap-sm active:scale-95 transition-transform duration-200"><span className="material-symbols-outlined" style={{ fontVariationSettings: '\'FILL\' 1' }}>
                    dashboard
                </span>
                Go to Dashboard
            </button><button className="w-full h-touch-target bg-transparent border border-outline text-primary font-label-md text-label-md rounded-full flex items-center justify-center gap-sm active:bg-surface-variant transition-colors duration-200"><span className="material-symbols-outlined">
                    person
                </span>
                View Patient Profile
            </button></div></main>
    </>
  )
}
