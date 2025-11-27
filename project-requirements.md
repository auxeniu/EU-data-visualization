Cerințe generale
Fiecare proiect va fi predat sub forma unei arhive zip cu denumirea de forma CodTema_NrGrupa_NUME_Prenume.zip și următoarea structură:
media: director care conține elementele media utilizate în cadrul proiectului (imagini, sunete, video, fișiere de date);
CodTema_NrGrupa_NUME_Prenume.html: fișier care conține codul HTML aferent proiectului;
CodTema_NrGrupa_NUME_Prenume.css: fișier care conține codul CSS aferent proiectului;
CodTema_NrGrupa_NUME_Prenume.js: fișier care conține codul JavaScript aferent proiectului.
Observații pentru fișierele CodTema_NrGrupa_NUME_Prenume.html/css/js:
trebuie să conțină doar cod sursă formatat și comentat;
sunt singurele care intră în evaluarea proiectului;  
sunt punctate doar în măsura în care studentul dovedește la evaluare cunoașterea elementelor utilizate;
nu este permis cod JavaScript preluat din nici o altă sursă (colegi, internet, etc.), cu excepția exemplelor de la curs / seminar publicate pe platforma online.ase.ro; orice fragment de cod preluat din alte surse se consideră tentativă de fraudă; se verifică automat;
este permisă preluarea de fișiere media, cod CSS, fișiere de date din orice sursă;
pentru implementarea cerințelor nu sunt permise alte biblioteci JavaScript (este permisă utilizarea Bootstrap – doar partea de CSS).  
Surse de documentare acceptate: Mozilla Developer Network (https://developer.mozilla.org/en-US/) și The Modern JavaScript Tutorial (https://javascript.info/).
Modalitate de transmitere: încărcare pe platforma https://ase.softmentor.ro/mmupload
Barem de corectare
1p Oficiu
3p Realizarea unei interfețe cu utilizatorul pentru tema primită folosind limbajele HTML și CSS
1p Atașarea de funcții de tratare pentru evenimentele controalelor utilizate
5p Implementare cerințe specifice temei alocate

_Tema_: Vizualizare date
Descriere: Construirea unei aplicații pentru vizualizarea unui set de date. Setul de date care cuprinde informații despre indicatorii “PIB pe cap de locuitor”, “Speranță de Viață” și “Populație” pentru țările Uniunii Europene în perioada 2000-2018 se va descărca de la adresa http://ase.softmentor.ro/eurostat.json (și va fi salvat în folder-ul media).

2p - preluare automată la pornirea aplicației a datelor curente despre PIB pe cap de locuitor / Speranta Viata / Populație pentru țările UE pentru ultimii 15 ani disponibili și procesare pentru aducerea la forma din fișierul furnizat. Documentația este disponibilă la adresa: https://wikis.ec.europa.eu/display/EUROSTATHELP/API+Statistics+-+data+query ; seturile de date folosite sunt: sdg_08_10?na_item=B1GQ&unit=CLV10_EUR_HAB,
demo_mlexpec?sex=T&age=Y1 și demo_pjan?sex=T&age=TOTAL; lista de țări este: BE, BG, CZ, DK, DE, EE, IE, EL, ES, FR, HR, IT, CY, LV, LT, LU, HU, MT, NL, AT, PL, PT, RO, SI, SK, FI, SE

Exemplu de apel (2 țări și 2 ani): https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/demo_mlexpec?sex=T&age=Y1&time=2019&time=2020&geo=RO&geo=BG
1p - afișare grafică evoluție pentru un indicator (PIB/SV/Pop) și o țară selectată de către utilizator - se va folosi un element de tip SVG (grafică vectorială); tipul de grafic (linie, histogramă, …) este la alegere
1p - pentru graficul de la punctul anterior să se afișeze un tooltip care să afișeze anul și valorile pentru PIB/SV/Pop pentru perioada corespunzătoare poziției mouse-ului
1p - afișare bubble chart pentru un an selectat de utilizator folosind un element de tip canvas (grafică raster)
1p - animație bubble chart (afișare bubble chart succesiv pentru toți anii)
2p - afișare sub formă de tabel a datelor disponibile pentru un an selectat de către utilizator (tarile pe linii și cei trei indicatori pe coloană); fiecare celulă va primi o culoare (de la roșu la verde) în funcție de distanța față de media uniunii
