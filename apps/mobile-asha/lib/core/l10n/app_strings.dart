/// Lightweight string localisation for ASHA Sathi.
///
/// A simple static key -> (en, hi) map. Intentionally avoids generated `.arb`
/// files. Extra languages fall back to English until translation maps exist.
class AppStrings {
  AppStrings._();

  static const Map<String, Map<String, String>> _strings = {
    'app_name': {'en': 'ASHA Sathi', 'hi': 'आशा साथी'},
    'welcome': {'en': 'Welcome', 'hi': 'स्वागत है'},
    'login': {'en': 'Login', 'hi': 'लॉगिन'},
    'logout': {'en': 'Logout', 'hi': 'लॉग आउट'},
    'send_otp': {'en': 'Send OTP', 'hi': 'OTP भेजें'},
    'verify_otp': {'en': 'Verify & Login', 'hi': 'सत्यापित करें और लॉगिन करें'},
    'resend_otp': {'en': 'Resend OTP', 'hi': 'OTP पुनः भेजें'},
    'enter_phone': {'en': 'Enter your 10-digit mobile number', 'hi': 'अपना 10 अंकों का मोबाइल नंबर दर्ज करें'},
    'enter_otp': {'en': 'Enter the 6-digit OTP sent to', 'hi': 'इस पर भेजा गया 6 अंकों का OTP दर्ज करें'},
    'offline_notice': {'en': 'You are offline. Data is saved on this device and will sync when online.', 'hi': 'आप ऑफ़लाइन हैं। डेटा इस डिवाइस पर सहेजा गया है और ऑनलाइन होने पर सिंक होगा।'},
    'home': {'en': 'Home', 'hi': 'होम'},
    'beneficiaries': {'en': 'Beneficiaries', 'hi': 'लाभार्थी'},
    'work_plan': {'en': 'Work Plan', 'hi': 'कार्य योजना'},
    'ai_assistant': {'en': 'AI Assistant', 'hi': 'AI सहायक'},
    'more': {'en': 'More', 'hi': 'अधिक'},
    'search': {'en': 'Search', 'hi': 'खोजें'},
    'save': {'en': 'Save', 'hi': 'सहेजें'},
    'cancel': {'en': 'Cancel', 'hi': 'रद्द करें'},
    'submit': {'en': 'Submit', 'hi': 'जमा करें'},
    'add': {'en': 'Add', 'hi': 'जोड़ें'},
    'retry': {'en': 'Retry', 'hi': 'पुनः प्रयास करें'},
    'no_data': {'en': 'No data available', 'hi': 'कोई डेटा उपलब्ध नहीं है'},
    'households': {'en': 'Households', 'hi': 'परिवार'},
    'village': {'en': 'Village', 'hi': 'गाँव'},
    'consent': {'en': 'Consent', 'hi': 'सहमति'},
    'pregnancy': {'en': 'Pregnancy', 'hi': 'गर्भावस्था'},
    'anc': {'en': 'ANC', 'hi': 'एएनसी'},
    'child': {'en': 'Child', 'hi': 'बच्चा'},
    'immunization': {'en': 'Immunization', 'hi': 'टीकाकरण'},
    'incentives': {'en': 'Incentives', 'hi': 'प्रोत्साहन'},
    'sync': {'en': 'Sync', 'hi': 'सिंक'},
    'settings': {'en': 'Settings', 'hi': 'सेटिंग्स'},
    'language': {'en': 'Language', 'hi': 'भाषा'},
    'theme': {'en': 'Theme', 'hi': 'थीम'},
    'about': {'en': 'About', 'hi': 'के बारे में'},
    'version': {'en': 'Version', 'hi': 'संस्करण'},
    'dashboard': {'en': 'Dashboard', 'hi': 'डैशबोर्ड'},
    'register': {'en': 'Register', 'hi': 'पंजीकरण'},
    'detail': {'en': 'Details', 'hi': 'विवरण'},
    'status': {'en': 'Status', 'hi': 'स्थिति'},
    'date': {'en': 'Date', 'hi': 'तिथि'},
    'name': {'en': 'Name', 'hi': 'नाम'},
    'phone': {'en': 'Phone', 'hi': 'फ़ोन'},
    'dob': {'en': 'Date of Birth', 'hi': 'जन्म तिथि'},
    'gender': {'en': 'Gender', 'hi': 'लिंग'},
    'blood_group': {'en': 'Blood Group', 'hi': 'रक्त समूह'},
    'high_risk': {'en': 'High Risk', 'hi': 'उच्च जोखिम'},
    'due_list': {'en': 'Due List', 'hi': 'अतिदेय सूची'},
    'completed': {'en': 'Completed', 'hi': 'पूर्ण'},
    'pending': {'en': 'Pending', 'hi': 'लंबित'},
    'home_tab': {'en': 'Home', 'hi': 'होम'},
    'sync_now': {'en': 'Sync Now', 'hi': 'अभी सिंक करें'},
    'last_sync': {'en': 'Last sync', 'hi': 'अंतिम सिंक'},
    'pending_changes': {'en': 'Pending changes', 'hi': 'लंबित परिवर्तन'},
    'notifications': {'en': 'Notifications', 'hi': 'सूचनाएँ'},
    'training': {'en': 'Training', 'hi': 'प्रशिक्षण'},
    'abha': {'en': 'ABHA', 'hi': 'आभा'},
    'ncd': {'en': 'NCD', 'hi': 'एनसीडी'},
    'referral': {'en': 'Referral', 'hi': 'रेफरल'},
    'all': {'en': 'All', 'hi': 'सभी'},
    'yes': {'en': 'Yes', 'hi': 'हाँ'},
    'no': {'en': 'No', 'hi': 'नहीं'},
    'ok': {'en': 'OK', 'hi': 'ठीक है'},
    'error': {'en': 'Something went wrong', 'hi': 'कुछ गलत हो गया'},
  };

  /// Look up [key] for [languageCode]; falls back to English.
  static String t(String key, {String languageCode = 'en'}) {
    final lang = _strings[key];
    if (lang == null) return key;
    return lang[languageCode] ?? lang['en'] ?? key;
  }
}
