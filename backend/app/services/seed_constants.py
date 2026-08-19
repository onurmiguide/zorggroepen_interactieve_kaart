"""Hardcoded waarden overgenomen uit script/script.js (2026-beslisboom).

Deze dienen als seed voor de database. De bron blijft script/script.js totdat
de admin-CRUD volledig leidend is. Bij wijzigingen in script.js kunnen deze
waarden opnieuw worden gesynchroniseerd.
"""
from __future__ import annotations

# DEFAULT_ZORGVERZEKERAARS
DEFAULT_ZORGVERZEKERAARS = [
    "a.s.r.", "Ik kies zelf", "Menzis Digitaal 2026", "Menzis", "Anderzorg",
    "VinkVink", "ONVZ", "VvAA", "VGZ", "IZA", "UMC Zorgverzekering", "Unive",
    "Zekur", "VGZbewuzt", "IZZ door VGZ", "Zilveren Kruis (Achmea)", "FBTO",
    "De Friesland", "Interpolis", "ZieZo", "De christelijke zorgverzekeraar",
    "Aevitae (Eucare)", "Aevitae", "Eucare", "Care4Life", "CZ",
    "Nationale-Nederlanden", "OHRA", "Just", "CZ direct", "DSW", "Stad Holland",
    "Salland", "Zorg & Zekerheid", "AZVZ",
    "Stichting Ziektekostenverzekering Krijgsmacht (SZVK)",
    "RMA",
]

# INSURER_LABEL_TO_CONCERN (genormaliseerde label -> concern_key)
INSURER_LABEL_TO_CONCERN = {
    "a s r": "a s r", "asr": "a s r", "ik kies zelf": "a s r",
    "menzis digitaal 2026": "menzis digitaal 2026", "menzis": "menzis digitaal 2026",
    "anderzorg": "menzis digitaal 2026", "vinkvink": "menzis digitaal 2026",
    "onvz": "onvz", "vvaa": "onvz",
    "vgz": "vgz", "iza": "vgz", "umc zorgverzekering": "vgz", "umc": "vgz",
    "unive": "vgz", "zekur": "vgz", "vgzbewuzt": "vgz", "vgz bewuzt": "vgz",
    "izz door vgz": "vgz", "izz": "vgz",
    "zilveren kruis achmea": "zilveren kruis achmea", "achmea": "zilveren kruis achmea",
    "zilveren kruis": "zilveren kruis achmea", "fbto": "zilveren kruis achmea",
    "de friesland": "zilveren kruis achmea", "interpolis": "zilveren kruis achmea",
    "ziezo": "zilveren kruis achmea",
    "de christelijke zorgverzekeraar": "zilveren kruis achmea",
    "aevitae eucare": "aevitae eucare", "aevitae": "aevitae eucare",
    "eucare": "aevitae eucare", "care4life": "aevitae eucare",
    "cz": "cz", "nationale nederlanden": "cz", "ohra": "cz", "just": "cz",
    "cz direct": "cz",
    "dsw": "dsw", "stad holland": "dsw",
    "salland": "salland",
    "zorg zekerheid": "zorg zekerheid", "zorg en zekerheid": "zorg zekerheid",
    "zorg zekerheid av": "zorg zekerheid", "azvz": "zorg zekerheid",
    "stichting ziektekostenverzekering krijgsmacht szvk": "szvk", "szvk": "szvk",
}

# FACTURATIESTROMEN
FACTURATIESTROMEN = {
    "STROOM_1": "Stroom 1 - Zorggroep declaraties",
    "STROOM_2": "Stroom 2 - VECOZO Gecontracteerde Zorg",
    "STROOM_3": "Stroom 3 - Niet gecontracteerde Zorg - Losse Facturen",
    "STROOM_4": "Stroom 4 - Gezondheid Amsterdam GA",
    "STROOM_5": "Stroom 5 - ZoHealthy",
}

FACTURATIESTROOM_CONTEXT = {
    "STROOM_1": "Zorggroepdeclaraties via zorggroepsystemen. Bekende modules/omgevingen: VIPLive, cBoards, Medix, Nis, Kysios.",
    "STROOM_2": "Gecontracteerde zorg via VECOZO voor Menzis, VGZ, a.s.r., Achmea/Zilveren Kruis en ONVZ.",
    "STROOM_3": "Niet-gecontracteerde zorg via losse facturen (CZ, DSW, Zorg & Zekerheid, Aevitae Eucare, Salland).",
    "STROOM_4": "Gezondheid Amsterdam (GA)-route voor de GA-context.",
    "STROOM_5": "ZoHealthy-route voor specifieke deelnemers/cohorten (zoals HHT/HZGB en periodegebonden groepen).",
}

# FACTURATIEMODULE_TEMPLATES (naam -> omschrijving)
FACTURATIEMODULE_TEMPLATES = {
    "CoOL via zorggroep": "CoOL via zorggroep. Gebruik wanneer declaraties via een zorggroep-context lopen (bijv. via zorggroep-afspraken of zorggroep-afhandeling).",
    "CoOL via ZORGVERZEKERAAR - via GA": "CoOL via zorgverzekeraar via GA-route. Specifieke module voor zorgverzekeraar-afhandeling via de GA-constructie.",
    "ESV": "CoOL-MiGuide via ESV. Declaraties voor deelnemers in de ESV-regio worden verwerkt via de ESV-facturatiemodule.",
    "Gezondheid Amsterdam (GA)": "CoOL-MiGuide via zorgverzekeraar voor de GA-regio. Declaraties van deelnemers in de GA-regio worden periodiek via een XML-bestand aangeleverd aan GA.",
    "LCK": "CoOL-MiGuide via LCK. Declaraties voor deelnemers uit de LCK-regio worden verwerkt via de nieuwe LCK-facturatiemodule.",
    "MiGuide": "CoOL-MiGuide via zorgverzekeraar. Declaraties worden direct vanuit MiGuide gedeclareerd aan andere zorgverzekeraars (niet VGZ), conform contractafspraken.",
    "MiGuide - VGZ": "CoOL via zorgverzekeraar (VGZ). Declaraties worden direct aan VGZ gedeclareerd vanuit MiGuide, conform contract met VGZ.",
    "ZoHealthy": "CoOL via zorgverzekeraar via ZoHealthy. Declaraties lopen via ZoHealthy en de verkooptarieven van ZoHealthy worden gebruikt.",
    "Zorggroep": "CoOL-MiGuide via zorggroep. Declaraties worden verwerkt via een platform/omgeving van een andere zorggroep (bijv. VIPLive of Monter); tarieven vanuit de zorggroep.",
    "Zuid Holland Zuid - CZ": "CoOL-MiGuide via zorgverzekeraar voor GLI-ZHZ-CZ. Declaraties voor CZ-gebied in dit contract worden via de statische declarant GLI-ZHZ-CZ gedeclareerd.",
    "Zuid Holland Zuid - VGZ": "CoOL via zorgverzekeraar voor GLI-ZHZ-VGZ. Declaraties voor VGZ-gebied in dit contract worden via de statische declarant GLI-ZHZ-VGZ gedeclareerd.",
}

# FACTURATIEMODULE_PRESTATIECODE (naam -> prestatiecode)
FACTURATIEMODULE_PRESTATIECODE = {
    "CoOL via zorggroep": "CoOL-MiGuide",
    "CoOL via ZORGVERZEKERAAR - via GA": "CoOL-MiGuide",
    "ESV": "CoOL-MiGuide",
    "Gezondheid Amsterdam (GA)": "CoOL-MiGuide",
    "LCK": "CoOL-MiGuide",
    "MiGuide": "CoOL-MiGuide",
    "MiGuide - VGZ": "CoOL",
    "ZoHealthy": "CoOL",
    "Zorggroep": "CoOL-MiGuide",
    "Zuid Holland Zuid - CZ": "CoOL-MiGuide",
    "Zuid Holland Zuid - VGZ": "CoOL-MiGuide",
}

# BESLISBOOM_ROUTE_BY_ZORGGROEP_2026 (genormaliseerde zorggroep-sleutel -> route_type)
# Volgorde bepaalt priority (lager = eerder/belangrijker).
BESLISBOOM_ROUTE_BY_ZORGGROEP_2026 = [
    ("esv", "esv"),
    ("zorggroep gezondheid amsterdam", "ga"),
    ("gezondheid amsterdam", "ga"),
    ("lck", "lck"),
    ("hht hzgb", "no_contract"),
    ("zorggroep almere", "zorggroep"),
    ("almere", "zorggroep"),
    ("geen zorggroep contract", "no_contract"),
    ("zhz cz", "zhz_cz"),
    ("zhz vgz", "zhz_vgz"),
    ("zuid holland zuid overig", "no_contract"),
    ("zuid holland zuid", "zhz"),
    ("rijnmond dokters", "zorggroep"),
    ("west friesland", "zorggroep"),
    ("ketenzorg friesland", "zorggroep"),
    ("zio", "zorggroep"),
    ("zorg in ontwikkeling", "zorggroep"),
    ("rhogo", "zorggroep"),
    ("rhogo regionale huisartsen organisatie gooi en omstreken bv", "zorggroep"),
    ("unicum", "zorggroep"),
    ("hoog", "no_contract"),
    ("medita", "zorggroep"),
    ("meditta", "zorggroep"),
    ("hozl", "zorggroep"),
    ("rijn en duin", "zorggroep"),
    ("amstelland", "zorggroep"),
    ("amstelland zorg", "zorggroep"),
    ("hadoks", "zorggroep"),
    ("humo", "zorggroep"),
    ("eemland", "zorggroep"),
    ("eemland huisartsen", "zorggroep"),
    ("kennemerland", "zorggroep"),
    ("kop noord holland", "zorggroep"),
    ("kop noordholland", "zorggroep"),
    ("stroomz", "zorggroep"),
    ("post z naam in zorgtraject stroomz", "zorggroep"),
    ("postz", "zorggroep"),
]
