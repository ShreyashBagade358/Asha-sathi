export default function ConnectionErrorAshaSathi() {
  return (
    <>
<main className="flex flex-col items-center justify-center w-full px-lg max-w-md mx-auto z-10 text-center relative pt-xl pb-xxl flex-grow">
<div className="relative w-32 h-32 mb-lg flex items-center justify-center rounded-full bg-error-container text-on-error-container shadow-sm"><span className="material-symbols-outlined text-[64px]" style={{ fontVariationSettings: '\'FILL\' 1' }}>cloud_off</span>
<div className="absolute inset-0 rounded-full border-4 border-error-container animate-ping opacity-75"></div></div>
<h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface mb-sm">Connection Error</h1>
<p className="font-body-lg-mobile text-body-lg-mobile text-on-surface-variant mb-xl px-md">
            We are having trouble reaching the server. Your data is safely stored locally and will upload when you reconnect.
        </p>
<div className="w-full flex flex-col gap-form-gap">
<button aria-label="Retry Connection" className="w-full h-touch-target bg-primary-container text-on-primary rounded-full font-label-md text-label-md flex items-center justify-center gap-sm shadow-sm hover:bg-primary transition-colors active:scale-95 duration-200"><span className="material-symbols-outlined" style={{ fontVariationSettings: '\'FILL\' 1' }}>refresh</span>
                Retry Connection
            </button>
<button aria-label="Open Sync Center" className="w-full h-touch-target bg-transparent border-2 border-outline-variant text-primary rounded-full font-label-md text-label-md flex items-center justify-center gap-sm hover:bg-surface-variant transition-colors active:scale-95 duration-200"><span className="material-symbols-outlined">sync</span>
                Open Sync Center
            </button></div>
<div className="mt-xl inline-flex items-center gap-xs px-md py-xs rounded-full bg-surface-container-high border border-outline-variant"><div className="w-2 h-2 rounded-full bg-outline"></div><span className="font-caption text-caption text-on-surface-variant">Currently Offline</span></div></main>
    </>
  )
}
