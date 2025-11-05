/**
 * WELCOME Message - ita
 */
export const welcomeMessageContent = {
  markdown: `Ciao! 

Ti diamo il benvenuto su IO, l’app che ti avvicina ai servizi pubblici in modo semplice, sicuro e trasparente.

**Con IO puoi:**

* **Ricevere comunicazioni che ti riguardano**, anche a valore legale, inviate dagli enti direttamente in app
* **Aggiungere i tuoi documenti personali e i certificati** in versione digitale e averli sempre a portata di mano
* **Pagare gli avvisi pagoPA** in pochi passaggi e con il metodo che preferisci, anche a rate
* **Consultare le ricevute** dei pagamenti pagoPA e scaricare i PDF
* **Richiedere e utilizzare bonus e iniziative**
* **Accedere da un unico spazio ai servizi** che gli enti, nazionali e locali, ti offrono su IO

**Iniziamo?**

Per prima cosa controlla di avere le **notifiche push attive**: così saprai subito quando ricevi un nuovo messaggio in app.

[Leggi come fare](https://assistenza.ioapp.it/hc/it/articles/39312288127377-Come-attivare-le-notifiche-push-su-IO)

Per conoscere meglio tutto ciò che puoi fare con IO, vai su [ioapp.it](https://ioapp.it/).
`,
  subject: `Ti diamo il benvenuto su IO`,
};

/**
 * HOW-TO Message - ita
 *
 * NOTE: How-to message is now converted to SEND welcome message
 */
export const howToContent = {
  markdown: `---
it:
    cta_1:
        text: "Attiva SEND su IO"
        action: "ioit://services/service-detail?serviceId=01G40DWQGKY5GRWSNM4303VNRP&activate=true"
en:
    cta_1:
        text: "Enable SEND on IO"
        action: "ioit://services/service-detail?serviceId=01G40DWQGKY5GRWSNM4303VNRP&activate=true"
---
Ciao!

Conosci SEND? Ti permette di ricevere le **comunicazioni a valore legale** - come esiti di pratiche, rimborsi o multe - in formato digitale.

Attiva il servizio su IO per riceverle direttamente in app e risparmiare!

# Come funziona?

Se attivi SEND su IO, ricevi in app le comunicazioni a valore legale che ti inviano gli enti pubblici. Puoi leggerle in tempo reale sul tuo dispositivo e pagare facilmente eventuali avvisi di pagamento allegati alle comunicazioni.

# Risparmia sui costi della raccomandata

Se accedi alle comunicazioni a valore legale su IO entro i tempi previsti, eviterai le raccomandate cartacee e i relativi costi. 

Premendo Attiva il servizio dichiari di aver letto l’[Informativa Privacy](https://cittadini.notifichedigitali.it/informativa-privacy) e di accettare i [Termini e Condizioni d’uso](https://cittadini.notifichedigitali.it/termini-di-servizio).
`,
  subject: `Ricevi su IO le comunicazioni a valore legale e risparmia`,
};

/**
 * CASHBACK Content - ita
 */
export const cashbackContent = {
  markdown: `---
it:
cta_1:
text: "Attiva il cashback"
action: "ioit://CTA_START_BPD"
en:
cta_1:
text: "Request cashback"
action: "ioit://CTA_START_BPD"
---
Aderisci al “Cashback” tramite la sezione **Portafoglio** dell’app IO: puoi ottenere un rimborso sugli acquisti effettuati con carte, bancomat e app di pagamento. Il “Cashback” è una delle iniziative del Piano Italia Cashless promosso dal Governo allo scopo di incentivare un maggiore utilizzo di moneta elettronica nel Paese.

#### Chi può richiederlo?
Se hai compiuto i 18 anni e risiedi in Italia, puoi ottenere un **rimborso in denaro** a fronte di acquisti personali e non per uso professionale con i tuoi **metodi di pagamento elettronici** presso **punti vendita fisici** (non online) situati sul territorio nazionale.

#### Come funziona il Cashback?
1. Il programma Cashback si divide in periodi di durata variabile. Il primo periodo **sperimentale** detto **“Extra Cashback di Natale”**, dura **dall'8 al 31 dicembre 2020.** I successivi dureranno 6 mesi ciascuno, a partire dal 1° gennaio 2021.
2. Per ogni periodo potrai ottenere un **rimborso massimo di €150**. Ogni acquisto effettuato con strumenti di pagamento elettronici **registrati** ai fini dell’iniziativa, ti farà accumulare il 10% dell’importo speso, fino ad un massimo di €15 per transazione.
3. Il cashback accumulato ti verrà rimborsato solo se avrai raggiunto il numero minimo di transazioni valide: **10 nel periodo sperimentale**, 50 in ciascuno dei semestri successivi.
4. Oltre al Cashback, **ma solo a partire dal 1° gennaio 2021**, **i primi 100mila** partecipanti che in ogni semestre hanno totalizzato il **maggior numero di transazioni valide**, ricevono un **Super Cashback di €1500**.
5. Al termine del periodo, ricevi il rimborso complessivo accumulato **sull’IBAN che indicherai durante l’attivazione.**

#### Come si aggiungono i metodi di pagamento?
Aggiungi subito i metodi **a te intestati** nella sezione [Portafoglio](ioit://WALLET_HOME), e abilitali al cashback quando richiesto. Ad oggi sono supportate carte di debito, credito, prepagate e PagoBANCOMAT. Stiamo lavorando per supportare altri metodi in futuro, come Bancomat Pay e Satispay. 

#### Come si aggiunge l'IBAN per ricevere il rimborso previsto?
Attiva il Cashback e inserisci l’IBAN quando richiesto. Puoi inserirlo anche in un secondo momento, ma ricordati di farlo entro il termine del periodo per avere diritto al rimborso.

Per poter attivare il Cashback, devi avere aggiornato IO all'ultima versione disponibile. Scaricala adesso!

[App Store](https://apps.apple.com/it/app/io/id1501681835)

[Play Store](https://play.google.com/store/apps/details?id=it.pagopa.io.app)
`,
  subject: `Attiva il Cashback!`,
};
