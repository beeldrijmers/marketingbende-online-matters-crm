import type { TranslationMessages } from "ra-core";

// Vendored instead of depending on the `ra-language-dutch` npm package: that
// package only ships react-admin v4 keys and drags in its own `ra-core@4`
// (a vulnerable transitive `lodash`) purely for a type import that has no
// runtime effect. Gaps against react-admin v5's `ra.*` keys are filled in
// below so nothing silently falls back to English.
export const dutchMessages: TranslationMessages = {
  ra: {
    action: {
      add_filter: "Voeg filter toe",
      add: "Toevoegen",
      back: "Ga terug",
      bulk_actions: "1 geselecteerd |||| %{smart_count} geselecteerd",
      cancel: "Annuleren",
      clear_array_input: "Lijst wissen",
      clear_input_value: "Veld wissen",
      clear_search: "Zoekopdracht wissen",
      clone: "Klonen",
      close_menu: "Menu sluiten",
      close: "Sluiten",
      confirm: "Bevestigen",
      create_item: "%{item} toevoegen",
      create: "Toevoegen",
      delete: "Verwijderen",
      edit: "Bewerken",
      expand: "Uitklappen",
      export: "Exporteer",
      list: "Lijst",
      move_down: "Omlaag verplaatsen",
      move_up: "Omhoog verplaatsen",
      open_menu: "Menu openen",
      open: "Openen",
      refresh: "Verversen",
      remove_all_filters: "Alle filters verwijderen",
      remove_filter: "Filter verwijderen",
      remove: "Verwijderen",
      reset: "Herstellen",
      save: "Opslaan",
      search_columns: "Kolommen zoeken",
      search: "Zoeken",
      select_all_button: "Alles selecteren",
      select_all: "Alles selecteren",
      select_columns: "Kolommen",
      select_row: "Selecteer rij",
      show: "Tonen",
      sort: "Sorteren",
      toggle_theme: "Thema wisselen",
      undo: "Ongedaan maken",
      unselect: "Deselecteer",
      update_application: "Applicatie herladen",
      update: "Update",
    },
    boolean: {
      true: "Ja",
      false: "Nee",
      null: "",
    },
    page: {
      access_denied: "Toegang geweigerd",
      authentication_error: "Authenticatiefout",
      create: "%{name} toevoegen",
      dashboard: "Dashboard",
      edit: "%{name} #%{id}",
      error: "Er is iets misgegaan",
      list: "%{name}",
      loading: "Aan het laden",
      not_found: "Niet gevonden",
      show: "%{name} #%{id}",
      empty: "Nog geen %{name}.",
      invite: "Wilt u er een toevoegen?",
    },
    input: {
      file: {
        upload_several:
          "Drag en drop bestanden om te uploaden, of klik om bestanden te selecteren.",
        upload_single:
          "Drag en drop een bestand om te uploaden, of klik om een bestand te selecteren.",
      },
      image: {
        upload_several:
          "Drag en drop afbeeldingen om te uploaden, of klik om bestanden te selecteren.",
        upload_single:
          "Drag en drop een afbeelding om te uploaden, of klik om een bestand te selecteren.",
      },
      references: {
        all_missing: "De gerefereerde elementen konden niet gevonden worden.",
        many_missing:
          "Een of meer van de gerefereerde elementen is niet meer beschikbaar.",
        single_missing:
          "Een van de gerefereerde elementen is niet meer beschikbaar",
      },
      password: {
        toggle_visible: "Wachtwoord verbergen",
        toggle_hidden: "Wachtwoord tonen",
      },
    },
    message: {
      about: "Over",
      access_denied: "U heeft geen toegang tot deze pagina",
      are_you_sure: "Weet u het zeker?",
      auth_error:
        "Er is een fout opgetreden bij het valideren van het authenticatietoken.",
      authentication_error:
        "De authenticatieserver gaf een foutmelding en uw gegevens konden niet worden gecontroleerd.",
      bulk_delete_content:
        "Weet u zeker dat u dit %{name} item wilt verwijderen? |||| Weet u zeker dat u deze %{smart_count} items wilt verwijderen?",
      bulk_delete_title:
        "Verwijder %{name} |||| Verwijder %{smart_count} %{name}",
      bulk_update_content:
        "Weet u zeker dat u dit %{name} wilt updaten? |||| Weet u zeker dat u deze %{smart_count} items wilt updaten?",
      bulk_update_title: "Update %{name} |||| Update %{smart_count} %{name}",
      clear_array_input: "Weet u zeker dat u de hele lijst wilt wissen?",
      delete_content: "Weet u zeker dat u dit item wilt verwijderen?",
      delete_title: "%{name} #%{id} verwijderen",
      details: "Details",
      error:
        "Er is een clientfout opgetreden en uw aanvraag kon niet worden voltooid.",
      invalid_form:
        "Het formulier is ongeldig. Controleer a.u.b. de foutmeldingen",
      loading: "De pagina is aan het laden, een moment a.u.b.",
      no: "Nee",
      not_found:
        "U heeft een verkeerde URL ingevoerd of een defecte link aangeklikt.",
      placeholder_data_warning: "Netwerkprobleem: verversen van data mislukt.",
      select_all_limit_reached:
        "Er zijn te veel elementen om ze allemaal te selecteren. Alleen de eerste %{max} elementen zijn geselecteerd.",
      yes: "Ja",
      unsaved_changes:
        "Sommige van uw wijzigingen zijn niet opgeslagen. Weet u zeker dat u ze wilt negeren?",
    },
    sort: {
      sort_by: "Sorteren op %{field} %{order}",
      ASC: "oplopend",
      DESC: "aflopend",
    },
    navigation: {
      breadcrumb_drawer_title: "Navigeer naar",
      breadcrumb_drawer_instructions:
        "Selecteer een pagina om naartoe te gaan.",
      clear_filters: "Filters wissen",
      no_results: "Geen resultaten gevonden",
      no_filtered_results: "Geen %{name} gevonden met de huidige filters.",
      no_more_results:
        "Pagina %{page} ligt buiten het bereik. Probeer de vorige pagina.",
      page_out_of_boundaries: "Paginanummer %{page} buiten bereik",
      page_out_from_end: "Laatste pagina",
      page_out_from_begin: "Eerste pagina",
      page_range_info: "%{offsetBegin}-%{offsetEnd} van %{total}",
      partial_page_range_info:
        "%{offsetBegin}-%{offsetEnd} van meer dan %{offsetEnd}",
      current_page: "Pagina %{page}",
      page: "Ga naar pagina %{page}",
      first: "Ga naar eerste pagina",
      last: "Ga naar laatste pagina",
      next: "Volgende",
      previous: "Vorige",
      page_rows_per_page: "Rijen per pagina:",
      skip_nav: "Doorgaan naar artikel",
    },
    auth: {
      auth_check_error: "Log in om door te gaan",
      email: "E-mail",
      user_menu: "Profiel",
      username: "Gebruikersnaam",
      password: "Wachtwoord",
      sign_in: "Inloggen",
      sign_in_error: "Authenticatie mislukt, probeer opnieuw a.u.b.",
      logout: "Uitloggen",
    },
    notification: {
      application_update_available: "Er is een nieuwe versie beschikbaar.",
      updated: "Element bijgewerkt |||| %{smart_count} elementen bijgewerkt",
      created: "Element toegevoegd",
      deleted: "Element verwijderd |||| %{smart_count} elementen verwijderd",
      bad_item: "Incorrect element",
      item_doesnt_exist: "Element bestaat niet",
      http_error: "Server communicatie fout",
      data_provider_error: "dataProvider fout. Open console voor meer details.",
      i18n_error: "Kan de vertalingen voor de opgegeven taal niet laden",
      offline: "Geen verbinding. Kon geen data ophalen.",
      canceled: "Actie geannuleerd",
      logged_out: "Uw sessie is beëindigd, maak opnieuw verbinding.",
      not_authorized: "U heeft geen toegang tot deze bron.",
    },
    validation: {
      required: "Verplicht",
      minLength: "Moet minimaal %{min} karakters bevatten",
      maxLength: "Mag hooguit %{max} karakters bevatten",
      minValue: "Moet groter of gelijk zijn aan %{min}",
      maxValue: "Moet kleiner of gelijk zijn aan %{max}",
      number: "Moet een getal zijn",
      email: "Moet een geldig e-mailadres zijn",
      oneOf: "Moet een zijn van: %{options}",
      regex: "Moet overeenkomen met een specifiek format (regexp): %{pattern}",
      unique: "Moet uniek zijn",
    },
    saved_queries: {
      label: "Opgeslagen zoekopdrachten",
      query_name: "Naam zoekopdracht",
      new_label: "Huidige zoekopdracht opslaan...",
      new_dialog_title: "Huidige zoekopdracht opslaan als",
      remove_label: "Opgeslagen zoekopdracht verwijderen",
      remove_label_with_name: 'Zoekopdracht "%{name}" verwijderen',
      remove_dialog_title: "Opgeslagen zoekopdracht verwijderen?",
      remove_message:
        "Weet u zeker dat u dit item uit uw lijst met opgeslagen zoekopdrachten wilt verwijderen?",
      help: "Filter de lijst en sla deze zoekopdracht op voor later",
    },
    configurable: {
      customize: "Aanpassen",
      configureMode: "Pas deze pagina aan",
      inspector: {
        title: "Inspecteren",
        content: "Beweeg over de UI elementen om ze aan te passen",
        reset: "Instellingen resetten",
        hideAll: "Alles verbergen",
        showAll: "Alles tonen",
      },
      Datagrid: {
        title: "Datagrid",
        unlabeled: "Labelloze rij #%{column}",
      },
      SimpleForm: {
        title: "Formulier",
        unlabeled: "Labelloos veld #%{input}",
      },
      SimpleList: {
        title: "Lijst",
        primaryText: "Primaire tekst",
        secondaryText: "Secundaire tekst",
        tertiaryText: "Tertiaire tekst",
      },
    },
    guesser: {
      empty: {
        message: "Controleer uw data provider",
        title: "Geen data om te tonen",
      },
    },
  },
  "ra-supabase": {
    auth: {
      forgot_password: "Wachtwoord vergeten?",
    },
  },
} as const;
