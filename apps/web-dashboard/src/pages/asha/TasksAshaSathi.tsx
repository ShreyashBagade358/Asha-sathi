export default function TasksAshaSathi() {
  return (
    <>
<header className="bg-surface shadow-sm fixed top-0 left-0 w-full z-50 flex justify-between items-center px-lg h-touch-target"><button className="text-on-surface-variant hover:bg-surface-variant active:scale-95 transition-transform duration-200 p-sm rounded-full flex items-center justify-center"><span className="material-symbols-outlined" data-icon="menu">menu</span></button><h1 className="font-headline-lg-mobile text-headline-lg-mobile text-primary">ASHA Sathi</h1><button className="text-on-surface-variant hover:bg-surface-variant active:scale-95 transition-transform duration-200 p-sm rounded-full flex items-center justify-center"><span className="material-symbols-outlined" data-icon="sync">sync</span></button></header>
<main className="flex-grow flex flex-col items-center justify-center px-lg text-center mt-[48px] mb-[72px]">
<div className="mb-lg w-32 h-32 rounded-full bg-surface-container-high flex items-center justify-center shadow-sm relative"><div className="absolute inset-0 rounded-full bg-secondary opacity-10 animate-pulse"></div><span className="material-symbols-outlined text-secondary" data-icon="task_alt" style={{ fontSize: '64px', fontVariationSettings: '\'FILL\' 1' }}>task_alt</span></div>
<h2 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface mb-sm">
            No Pending Tasks for Today
        </h2>
<p className="font-body-lg-mobile text-body-lg-mobile text-on-surface-variant mb-xl max-w-xs mx-auto">
            All scheduled visits and follow-ups are completed. Great job!
        </p>
<button className="bg-primary-container text-on-primary-container font-label-md text-label-md h-touch-target px-xl rounded-full hover:opacity-90 active:scale-95 transition-all duration-200 shadow-sm flex items-center gap-sm"><span>View Upcoming Tasks</span><span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_forward</span></button></main>
<nav className="bg-surface-container shadow-lg fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-sm py-sm">
<button className="flex flex-col items-center justify-center text-on-surface-variant px-lg py-xs hover:bg-surface-variant active:scale-95 transition-all duration-150 rounded-lg group"><span className="material-symbols-outlined mb-xs group-hover:scale-110 transition-transform" data-icon="home">home</span><span className="font-label-md text-[10px] leading-tight">Home</span></button>
<button className="flex flex-col items-center justify-center text-on-surface-variant px-lg py-xs hover:bg-surface-variant active:scale-95 transition-all duration-150 rounded-lg group"><span className="material-symbols-outlined mb-xs group-hover:scale-110 transition-transform" data-icon="group">group</span><span className="font-label-md text-[10px] leading-tight">Households</span></button>
<button className="flex flex-col items-center justify-center text-on-surface-variant px-lg py-xs hover:bg-surface-variant active:scale-95 transition-all duration-150 rounded-lg group"><span className="material-symbols-outlined mb-xs group-hover:scale-110 transition-transform" data-icon="person">person</span><span className="font-label-md text-[10px] leading-tight">Patients</span></button>
<button className="flex flex-col items-center justify-center bg-primary-container text-on-primary-container rounded-full px-lg py-xs active:scale-95 transition-all duration-150 shadow-sm"><span className="material-symbols-outlined mb-xs" data-icon="assignment" style={{ fontVariationSettings: '\'FILL\' 1' }}>assignment</span><span className="font-label-md text-[10px] leading-tight font-bold">Tasks</span></button>
<button className="flex flex-col items-center justify-center text-on-surface-variant px-lg py-xs hover:bg-surface-variant active:scale-95 transition-all duration-150 rounded-lg group"><span className="material-symbols-outlined mb-xs group-hover:scale-110 transition-transform" data-icon="account_circle">account_circle</span><span className="font-label-md text-[10px] leading-tight">Profile</span></button></nav>
    </>
  )
}
