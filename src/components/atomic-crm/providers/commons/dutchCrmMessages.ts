import type { CrmMessages } from "./englishCrmMessages";

export const dutchCrmMessages = {
  resources: {
    companies: {
      name: "Bedrijf |||| Bedrijven",
      forcedCaseName: "Bedrijf",
      fields: {
        name: "Bedrijfsnaam",
        website: "Website",
        linkedin_url: "LinkedIn-URL",
        phone_number: "Telefoonnummer",
        created_at: "Aangemaakt op",
        nb_contacts: "Aantal contacten",
        revenue: "Omzet",
        sector: "Sector",
        size: "Grootte",
        tax_identifier: "Btw-nummer",
        address: "Adres",
        city: "Plaats",
        zipcode: "Postcode",
        state_abbr: "Provincie",
        country: "Land",
        description: "Omschrijving",
        context_links: "Contextlinks",
        sales_id: "Accountmanager",
      },
      empty: {
        description: "Het lijkt erop dat uw bedrijvenlijst leeg is.",
        title: "Geen bedrijven gevonden",
      },
      field_categories: {
        contact: "Contact",
        additional_info: "Aanvullende informatie",
        address: "Adres",
        context: "Context",
      },
      action: {
        create: "Bedrijf aanmaken",
        edit: "Bedrijf bewerken",
        new: "Nieuw bedrijf",
        show: "Bedrijf bekijken",
      },
      added_on: "Toegevoegd op %{date}",
      followed_by: "Gevolgd door %{name}",
      followed_by_you: "Gevolgd door u",
      no_contacts: "Geen contact",
      nb_contacts: "%{smart_count} contact |||| %{smart_count} contacten",
      nb_deals: "%{smart_count} deal |||| %{smart_count} deals",
      sizes: {
        one_employee: "1 medewerker",
        two_to_nine_employees: "2-9 medewerkers",
        ten_to_forty_nine_employees: "10-49 medewerkers",
        fifty_to_two_hundred_forty_nine_employees: "50-249 medewerkers",
        two_hundred_fifty_or_more_employees: "250 of meer medewerkers",
      },
      autocomplete: {
        create_error:
          "Er is een fout opgetreden bij het aanmaken van het bedrijf",
        create_item: "%{item} aanmaken",
        create_label: "Begin met typen om een nieuw bedrijf aan te maken",
      },
      filters: {
        only_mine: "Alleen bedrijven die ik beheer",
      },
    },
    contacts: {
      name: "Contact |||| Contacten",
      forcedCaseName: "Contact",
      field_categories: {
        background_info: "Achtergrondinformatie",
        identity: "Identiteit",
        misc: "Overig",
        personal_info: "Persoonlijke gegevens",
        position: "Functie",
      },
      fields: {
        first_name: "Voornaam",
        last_name: "Achternaam",
        last_seen: "Laatst gezien",
        title: "Functietitel",
        company_id: "Bedrijf",
        email_jsonb: "E-mailadressen",
        email: "E-mail",
        phone_jsonb: "Telefoonnummers",
        phone_number: "Telefoonnummer",
        linkedin_url: "LinkedIn-URL",
        background: "Achtergrondinformatie (bio, hoe u elkaar kent, etc.)",
        has_newsletter: "Ontvangt nieuwsbrief",
        sales_id: "Accountmanager",
      },
      action: {
        add: "Contact toevoegen",
        add_first: "Voeg uw eerste contact toe",
        create: "Contact aanmaken",
        edit: "Contact bewerken",
        export_vcard: "Exporteren naar vCard",
        new: "Nieuw contact",
        show: "Contact bekijken",
      },
      background: {
        last_activity_on: "Laatste activiteit op %{date}",
        added_on: "Toegevoegd op %{date}",
        followed_by: "Gevolgd door %{name}",
        followed_by_you: "Gevolgd door u",
        status_none: "Geen",
      },
      position_at: "%{title} bij",
      position_at_company: "%{title} bij %{company}",
      empty: {
        description: "Het lijkt erop dat uw contactenlijst leeg is.",
        title: "Geen contacten gevonden",
      },
      import: {
        title: "Contacten importeren",
        button: "CSV importeren",
        complete:
          "Import van contacten voltooid. %{importCount} contacten geïmporteerd, met %{errorCount} fouten",
        progress:
          "%{importCount} / %{rowCount} contacten geïmporteerd, met %{errorCount} fouten.",
        error:
          "Dit bestand kon niet worden geïmporteerd. Controleer of u een geldig CSV-bestand heeft opgegeven.",
        imported: "Geïmporteerd",
        remaining_time: "Geschatte resterende tijd:",
        running: "De import is bezig, sluit dit tabblad niet.",
        sample_download: "Voorbeeld-CSV downloaden",
        sample_hint:
          "Hier is een voorbeeld-CSV-bestand dat u als sjabloon kunt gebruiken",
        stop: "Import stoppen",
        csv_file: "CSV-bestand",
        contacts_label: "contact |||| contacten",
      },
      inputs: {
        genders: {
          male: "Hij/Hem",
          female: "Zij/Haar",
          nonbinary: "Die/Hen",
        },
        personal_info_types: {
          work: "Werk",
          home: "Privé",
          other: "Overig",
        },
      },
      list: {
        error_loading: "Fout bij het laden van contacten",
      },
      bulk_tag: {
        action: "Label",
        back: "Terug naar labels",
        create_description:
          "Maak een nieuw label aan en pas het toe op de geselecteerde contacten.",
        description:
          "Kies een bestaand label of maak een nieuwe aan voor de geselecteerde contacten.",
        empty:
          "Nog geen labels. Maak er een aan om de geselecteerde contacten te labelen.",
        error: "Label toevoegen aan contacten mislukt",
        noop: "Geselecteerde contacten hebben dit label al",
        success:
          "Label toegevoegd aan %{smart_count} contact |||| Label toegevoegd aan %{smart_count} contacten",
        title: "Label toevoegen aan contacten",
      },
      merge: {
        action: "Samenvoegen met ander contact",
        confirm: "Contacten samenvoegen",
        current_contact: "Huidig contact (wordt verwijderd)",
        description: "Voeg dit contact samen met een ander contact.",
        error: "Samenvoegen van contacten mislukt",
        merging: "Bezig met samenvoegen...",
        no_additional_data: "Geen aanvullende gegevens om samen te voegen",
        select_target: "Selecteer een contact om mee samen te voegen",
        success: "Contacten succesvol samengevoegd",
        target_contact: "Doelcontact (blijft behouden)",
        title: "Contact samenvoegen",
        warning_description:
          "Alle gegevens worden overgezet naar het tweede contact. Deze actie kan niet ongedaan worden gemaakt.",
        warning_title: "Waarschuwing: onomkeerbare actie",
        what_will_be_merged: "Wat wordt samengevoegd:",
      },
      filters: {
        before_last_month: "Voor vorige maand",
        before_this_month: "Voor deze maand",
        before_this_week: "Voor deze week",
        managed_by_me: "Beheerd door mij",
        search: "Zoek naam, bedrijf...",
        this_week: "Deze week",
        today: "Vandaag",
        tags: "Labels",
        tasks: "Taken",
      },
      hot: {
        empty_change_status:
          'Wijzig de status van een contact door een notitie aan dat contact toe te voegen en op "opties tonen" te klikken.',
        empty_hint: 'Contacten met de status "hot" verschijnen hier.',
        title: "Hot contacten",
      },
    },
    deals: {
      name: "Deal |||| Deals",
      forcedCaseName: "Deal",
      fields: {
        name: "Naam",
        description: "Omschrijving",
        company_id: "Bedrijf",
        contact_ids: "Contacten",
        category: "Categorie",
        amount: "Budget",
        expected_closing_date: "Verwachte afsluitdatum",
        start_date: "Startdatum",
        delivery_date: "Opleverdatum",
        stage: "Fase",
      },
      action: {
        back_to_deal: "Terug naar deal",
        create: "Deal aanmaken",
        new: "Nieuwe deal",
      },
      field_categories: {
        misc: "Overig",
      },
      archived: {
        action: "Archiveren",
        error: "Fout: deal niet gearchiveerd",
        list_title: "Gearchiveerde deals",
        success: "Deal gearchiveerd",
        title: "Gearchiveerde deal",
        view: "Gearchiveerde deals bekijken",
      },
      moneybird: {
        estimate: {
          action: "Offerte in Moneybird",
          view: "Bekijk offerte in Moneybird",
          pending: "Offerte wordt aangemaakt...",
          dialog_title: "Moneybird-offerte aanmaken",
          dialog_description:
            "Controleer de gegevens en maak een concept-offerte aan in Moneybird voor dit deal.",
          confirm: "Offerte aanmaken",
          warning:
            "Dit maakt een echte concept-offerte aan in de Moneybird-administratie van Marketingbende. Het wordt niet automatisch naar de klant gemaild.",
          success: "Offerte aangemaakt in Moneybird",
          error: "Aanmaken van de offerte is mislukt",
        },
        invoice: {
          action: "Factuur in Moneybird",
          view: "Bekijk factuur in Moneybird",
          pending: "Factuur wordt aangemaakt...",
          dialog_title: "Moneybird-factuur aanmaken",
          dialog_description:
            "Controleer de gegevens en maak een concept-factuur aan in Moneybird voor dit deal.",
          confirm: "Factuur aanmaken",
          warning:
            "Dit maakt een echte concept-factuur aan in de Moneybird-administratie van Marketingbende. De factuur wordt NIET automatisch verzonden; verstuur hem zelf vanuit Moneybird.",
          success: "Factuur aangemaakt in Moneybird",
          error: "Aanmaken van de factuur is mislukt",
        },
        company: "Bedrijf",
        amount: "Bedrag",
        no_address: "Geen adres bekend voor dit bedrijf",
        description_label: "Omschrijving op het document",
        tax_rate: "BTW-tarief",
        tax_rate_placeholder: "Kies een btw-tarief",
        tax_rate_loading: "Tarieven laden...",
        no_contact_hint:
          "Er is geen contactpersoon gekoppeld; het document gaat naar het bedrijf.",
        multiple_contacts_hint:
          "Er zijn meerdere contactpersonen gekoppeld; het document gaat naar het bedrijf, niet naar een specifiek contact.",
        warning_title: "Let op: echt document",
        no_company:
          "Dit deal heeft geen gekoppeld bedrijf; koppel eerst een bedrijf.",
        no_amount: "Dit deal heeft geen bedrag; stel eerst een bedrag in.",
        wrong_currency:
          "De Moneybird-koppeling werkt alleen met de valuta EUR.",
        creating: "Bezig met aanmaken...",
      },
      inbound: {
        title: "Inkomende e-mail",
        description:
          "Stuur e-mails door naar dit adres of zet het in de Cc om ze automatisch als notitie aan deze deal toe te voegen.",
      },
      inputs: {
        linked_to: "Gekoppeld aan",
      },
      unarchived: {
        action: "Terugzetten op het bord",
        error: "Fout: deal niet gedearchiveerd",
        success: "Deal gedearchiveerd",
      },
      updated: "Deal bijgewerkt",
      empty: {
        before_create: "voordat u een deal aanmaakt.",
        description: "Het lijkt erop dat uw deallijst leeg is.",
        title: "Geen deals gevonden",
      },
      invalid_date: "Ongeldige datum",
      no_date: "Nog niet gepland",
      no_amount: "Nog geen bedrag",
      filters: {
        only_mine: "Alleen mijn deals",
      },
    },
    notes: {
      name: "Notitie |||| Notities",
      forcedCaseName: "Notitie",
      fields: {
        status: "Status",
        date: "Datum",
        attachments: "Bijlagen",
        contact_id: "Contact",
        deal_id: "Deal",
      },
      action: {
        add: "Notitie toevoegen",
        add_first: "Voeg uw eerste notitie toe",
        delete: "Notitie verwijderen",
        edit: "Notitie bewerken",
        update: "Notitie bijwerken",
        add_this: "Deze notitie toevoegen",
      },
      sheet: {
        create: "Notitie aanmaken",
        create_for: "Notitie aanmaken voor %{name}",
        edit: "Notitie bewerken",
        edit_for: "Notitie bewerken voor %{name}",
      },
      deleted: "Notitie verwijderd",
      empty: "Nog geen notities",
      unknown_author: "een teamlid",
      author_added: "%{name} heeft een notitie toegevoegd",
      you_added: "U heeft een notitie toegevoegd",
      me: "Ik",
      list: {
        error_loading: "Fout bij het laden van notities",
      },
      note_for_contact: "Notitie voor %{name}",
      stepper: {
        hint: "Ga naar een contactpagina en voeg een notitie toe",
      },
      added: "Notitie toegevoegd",
      inputs: {
        add_note: "Voeg een notitie toe",
        options_hint: "(bestanden bijvoegen of details wijzigen)",
        show_options: "Opties tonen",
      },
      actions: {
        attach_document: "Document bijvoegen",
      },
      validation: {
        note_or_attachment_required: "Een notitie of bijlage is verplicht",
      },
    },
    sales: {
      name: "Gebruiker |||| Gebruikers",
      fields: {
        first_name: "Voornaam",
        last_name: "Achternaam",
        email: "E-mail",
        administrator: "Beheerder",
        disabled: "Uitgeschakeld",
        partij: "Partij",
      },
      create: {
        error: "Er is een fout opgetreden bij het aanmaken van de gebruiker.",
        success:
          "Gebruiker aangemaakt. Deze ontvangt binnenkort een e-mail om een wachtwoord in te stellen.",
        title: "Nieuwe gebruiker aanmaken",
      },
      edit: {
        error: "Er is een fout opgetreden. Probeer het opnieuw.",
        record_not_found: "Record niet gevonden",
        success: "Gebruiker succesvol bijgewerkt",
        title: "%{name} bewerken",
      },
      action: {
        new: "Nieuwe gebruiker",
      },
    },
    tasks: {
      name: "Taak |||| Taken",
      forcedCaseName: "Taak",
      fields: {
        text: "Omschrijving",
        due_date: "Vervaldatum",
        type: "Type",
        contact_id: "Contact",
        due_short: "verloopt",
        sales_id: "Toegewezen aan",
      },
      action: {
        add: "Taak toevoegen",
        create: "Taak aanmaken",
        edit: "Taak bewerken",
      },
      actions: {
        postpone_next_week: "Uitstellen naar volgende week",
        postpone_tomorrow: "Uitstellen naar morgen",
        title: "taakacties",
      },
      added: "Taak toegevoegd",
      deleted: "Taak succesvol verwijderd",
      dialog: {
        create: "Taak aanmaken",
        create_for: "Taak aanmaken voor %{name}",
      },
      sheet: {
        edit: "Taak bewerken",
        edit_for: "Taak bewerken voor %{name}",
      },
      empty: "Nog geen taken",
      empty_list_hint:
        "Taken die aan uw contacten zijn toegevoegd, verschijnen hier.",
      filters: {
        later: "Later",
        overdue: "Verlopen",
        this_week: "Deze week",
        today: "Vandaag",
        tomorrow: "Morgen",
        with_pending: "Met openstaande taken",
        mine: "Mijn taken",
        team: "Team",
      },
      regarding_contact: "(Betreft: %{name})",
      updated: "Taak bijgewerkt",
    },
    tags: {
      name: "Label |||| Labels",
      action: {
        add: "Label toevoegen",
        create: "Nieuw label aanmaken",
      },
      dialog: {
        color: "Kleur",
        create_title: "Nieuw label aanmaken",
        edit_title: "Label bewerken",
        name_label: "Naam van label",
        name_placeholder: "Voer labelnaam in",
      },
    },
  },
  crm: {
    action: {
      reset_password: "Wachtwoord resetten",
    },
    auth: {
      first_name: "Voornaam",
      last_name: "Achternaam",
      confirm_password: "Bevestig wachtwoord",
      confirmation_required:
        "Volg de link die we u zojuist per e-mail hebben gestuurd om uw account te bevestigen.",
      recovery_email_sent:
        "Als u een geregistreerde gebruiker bent, ontvangt u binnenkort een e-mail om uw wachtwoord te herstellen.",
      sign_in_failed: "Inloggen mislukt.",
      sign_in_google_workspace: "Inloggen met Google Workspace",
      signup: {
        create_account: "Account aanmaken",
        create_first_user:
          "Maak het eerste gebruikersaccount aan om de installatie te voltooien.",
        creating: "Bezig met aanmaken...",
        initial_user_created: "Eerste gebruiker succesvol aangemaakt",
      },
      welcome_title: "Welkom bij %{title}",
    },
    common: {
      activity: "Activiteit",
      added: "toegevoegd",
      details: "Details",
      last_activity_with_date: "laatste activiteit %{date}",
      load_more: "Meer laden",
      misc: "Overig",
      past: "Verleden",
      read_more: "Lees meer",
      retry: "Opnieuw proberen",
      show_less: "Minder tonen",
      copied: "Gekopieerd!",
      copy: "Kopiëren",
      loading: "Bezig met laden...",
      me: "Ik",
      task_count: "%{smart_count} taak |||| %{smart_count} taken",
    },
    changelog: {
      title: "Wijzigingslog",
    },
    activity: {
      added_company: "%{name} heeft een bedrijf toegevoegd",
      you_added_company: "U heeft een bedrijf toegevoegd",
      added_contact: "%{name} heeft toegevoegd",
      you_added_contact: "U heeft toegevoegd",
      added_note: "%{name} heeft een notitie toegevoegd over",
      you_added_note: "U heeft een notitie toegevoegd over",
      added_note_about_deal: "%{name} heeft een notitie toegevoegd over deal",
      you_added_note_about_deal: "U heeft een notitie toegevoegd over deal",
      added_deal: "%{name} heeft een deal toegevoegd",
      you_added_deal: "U heeft een deal toegevoegd",
      at_company: "bij",
      to: "aan",
      load_more: "Meer activiteit laden",
      someone: "een teamlid",
      today: "Vandaag",
      yesterday: "Gisteren",
    },
    ownership: {
      you: "Jij",
      unknown: "Onbekend",
      party: {
        online_matters: "Online Matters",
        marketingbende: "Marketingbende",
        groeien_met_ads: "Groeien met Ads",
      },
      filter: {
        owner: "Eigenaar",
        all: "Alles",
        mine: "Van mij",
      },
    },
    dashboard: {
      deals_chart: "Verwachte deal-omzet",
      deals_pipeline: "Deals pipeline",
      latest_activity: "Laatste activiteit",
      latest_activity_error: "Fout bij het laden van de laatste activiteit",
      latest_notes: "Mijn laatste notities",
      latest_notes_added_ago: "toegevoegd %{timeAgo}",
      stepper: {
        install: "%{title} installeren",
        progress: "%{step}/3 voltooid",
        whats_next: "Wat nu?",
      },
      upcoming_tasks: "Aankomende taken",
    },
    header: {
      import_data: "Gegevens importeren",
    },
    image_editor: {
      change: "Wijzigen",
      drop_hint:
        "Sleep een bestand hierheen om te uploaden, of klik om het te selecteren.",
      editable_content: "Bewerkbare inhoud",
      title: "Afbeelding uploaden en formaat wijzigen",
      update_image: "Afbeelding bijwerken",
    },
    import: {
      action: {
        download_error_report: "Download het foutenrapport",
        import: "Importeren",
        import_another: "Nog een bestand importeren",
      },
      error: {
        unable: "Dit bestand kan niet worden geïmporteerd.",
      },
      idle: {
        description_1:
          "U kunt gebruikers, bedrijven, contacten, notities en taken importeren.",
        description_2:
          "Gegevens moeten in een JSON-bestand staan dat overeenkomt met het volgende voorbeeld:",
      },
      status: {
        all_success: "Alle records zijn succesvol geïmporteerd.",
        complete: "Import voltooid.",
        failed: "Mislukt",
        imported: "Geïmporteerd",
        in_progress: "Import bezig, verlaat deze pagina niet.",
        some_failed: "Sommige records zijn niet geïmporteerd.",
        table_caption: "Importstatus",
      },
      title: "Gegevens importeren",
    },
    settings: {
      about: "Over",
      companies: {
        sectors: "Sectoren",
      },
      dark_mode_logo: "Logo donkere modus",
      deals: {
        categories: "Categorieën",
        currency: "Valuta",
        pipeline_help:
          "Selecteer welke dealfasen meetellen als pipeline-deals.",
        pipeline_statuses: "Pipelinestatussen",
        stages: "Fasen",
      },
      light_mode_logo: "Logo lichte modus",
      notes: {
        statuses: "Statussen",
      },
      reset_defaults: "Terugzetten naar standaardinstellingen",
      save_error: "Configuratie opslaan mislukt",
      saved: "Configuratie succesvol opgeslagen",
      saving: "Bezig met opslaan...",
      tasks: {
        types: "Types",
      },
      preferences: "Voorkeuren",
      title: "Instellingen",
      app_title: "App-titel",
      sections: {
        branding: "Huisstijl",
      },
      validation: {
        duplicate: "Dubbele %{display_name}: %{items}",
        in_use:
          "Kan %{display_name} die nog worden gebruikt door deals niet verwijderen: %{items}",
        validating: "Bezig met valideren…",
        entities: {
          categories: "categorieën",
          stages: "fasen",
        },
      },
    },
    theme: {
      dark: "Donker",
      label: "Thema",
      light: "Licht",
      system: "Systeem",
    },
    language: "Taal",
    navigation: {
      label: "CRM-navigatie",
    },
    profile: {
      inbound: {
        description:
          "U kunt e-mails sturen naar het inkomende e-mailadres van uw server, bijvoorbeeld door dit toe te voegen aan het veld %{field}. Het CRM verwerkt de e-mails en voegt notities toe aan de bijbehorende contacten.",
        title: "Inkomende e-mail",
      },
      mcp: {
        title: "MCP-server",
        description:
          "Gebruik deze URL om uw AI-assistent via het Model Context Protocol (MCP) te koppelen aan uw CRM-gegevens.",
      },
      password: {
        change: "Wachtwoord wijzigen",
      },
      password_reset_sent:
        "Er is een e-mail voor het resetten van uw wachtwoord naar uw e-mailadres verzonden",
      record_not_found: "Record niet gevonden",
      title: "Profiel",
      updated: "Uw profiel is bijgewerkt",
      update_error: "Er is een fout opgetreden. Probeer het opnieuw",
    },
    validation: {
      invalid_url: "Moet een geldige URL zijn",
      invalid_linkedin_url: "URL moet van linkedin.com zijn",
    },
  },
} satisfies CrmMessages;
