import type { CrmMessages } from "./englishCrmMessages";

export const frenchCrmMessages = {
  resources: {
    companies: {
      name: "Entreprise |||| Entreprises",
      forcedCaseName: "Entreprise",
      fields: {
        name: "Nom de l'entreprise",
        website: "Site web",
        linkedin_url: "LinkedIn",
        phone_number: "Numéro de téléphone",
        created_at: "Date de création",
        nb_contacts: "Nombre de contacts",
        revenue: "Chiffre d'affaires",
        sector: "Secteur",
        size: "Taille",
        tax_identifier: "Identifiant fiscal",
        address: "Adresse",
        city: "Ville",
        zipcode: "Code postal",
        state_abbr: "État",
        country: "Pays",
        description: "Description",
        context_links: "URLs de contexte",
        sales_id: "Responsable de compte",
      },
      empty: {
        description: "Il semble que la liste de vos entreprises soit vide.",
        title: "Aucune entreprise trouvée",
      },
      field_categories: {
        contact: "Contact",
        additional_info: "Informations supplémentaires",
        address: "Adresse",
        context: "Contexte",
      },
      action: {
        create: "Créer une entreprise",
        edit: "Modifier l'entreprise",
        new: "Nouvelle entreprise",
        show: "Afficher l'entreprise",
      },
      added_on: "Ajoutée le %{date}",
      followed_by: "Suivie par %{name}",
      followed_by_you: "Suivie par vous",
      no_contacts: "Aucun contact",
      nb_contacts: "%{smart_count} contact |||| %{smart_count} contacts",
      nb_deals: "%{smart_count} affaire |||| %{smart_count} affaires",
      sizes: {
        one_employee: "1 employé",
        two_to_nine_employees: "2-9 employés",
        ten_to_forty_nine_employees: "10-49 employés",
        fifty_to_two_hundred_forty_nine_employees: "50-249 employés",
        two_hundred_fifty_or_more_employees: "250 employés ou plus",
      },
      autocomplete: {
        create_error:
          "Une erreur s'est produite lors de la création de l'entreprise",
        create_item: "Créer %{item}",
        create_label: "Commencez à taper pour créer une nouvelle entreprise",
      },
      filters: {
        only_mine: "Seulement les entreprises que je gère",
      },
    },
    contacts: {
      name: "Contact |||| Contacts",
      forcedCaseName: "Contact",
      field_categories: {
        background_info: "Informations complémentaires",
        identity: "Identité",
        misc: "Divers",
        personal_info: "Informations personnelles",
        position: "Poste",
      },
      fields: {
        first_name: "Prénom",
        last_name: "Nom",
        last_seen: "Dernière activité",
        title: "Titre",
        company_id: "Entreprise",
        email_jsonb: "Adresses e-mail",
        email: "E-mail",
        phone_jsonb: "Numéros de téléphone",
        phone_number: "Numéro de téléphone",
        linkedin_url: "URL LinkedIn",
        background: "Informations de contexte",
        has_newsletter: "Abonné à la newsletter",
        sales_id: "Responsable de compte",
      },
      action: {
        add: "Ajouter un contact",
        add_first: "Ajoutez votre premier contact",
        create: "Créer un contact",
        edit: "Modifier le contact",
        export_vcard: "Exporter en vCard",
        new: "Nouveau contact",
        show: "Afficher le contact",
      },
      background: {
        last_activity_on: "Dernière activité le %{date}",
        added_on: "Ajouté le %{date}",
        followed_by: "Suivi par %{name}",
        followed_by_you: "Suivi par vous",
        status_none: "Aucun",
      },
      position_at: "%{title} chez",
      position_at_company: "%{title} chez %{company}",
      empty: {
        description: "Il semble que votre liste de contacts soit vide.",
        title: "Aucun contact trouvé",
      },
      import: {
        title: "Importer des contacts",
        button: "Importer un fichier CSV",
        complete:
          "Import des contacts terminé. %{importCount} contacts importés, %{errorCount} erreurs",
        progress:
          "%{importCount} / %{rowCount} contacts importés, avec %{errorCount} erreurs.",
        error:
          "Échec de l'importation de ce fichier. Veuillez vous assurer que vous avez fourni un fichier CSV valide.",
        imported: "Importé",
        remaining_time: "Temps restant estimé :",
        running: "L'import est en cours, merci de ne pas fermer cet onglet.",
        sample_download: "Télécharger un exemple CSV",
        sample_hint:
          "Voici un exemple de fichier CSV que vous pouvez utiliser comme modèle",
        stop: "Arrêter l'importation",
        csv_file: "Fichier CSV",
        contacts_label: "contact |||| contacts",
      },
      inputs: {
        genders: {
          male: "Monsieur",
          female: "Madame",
          nonbinary: "Indéterminé",
        },
        personal_info_types: {
          work: "Pro",
          home: "Perso",
          other: "Autre",
        },
      },
      list: {
        error_loading: "Erreur lors du chargement des contacts",
      },
      bulk_tag: {
        action: "Étiqueter",
        back: "Retour aux étiquettes",
        create_description:
          "Créez une nouvelle étiquette et appliquez-la aux contacts sélectionnés.",
        description:
          "Choisissez une étiquette existante ou créez-en une pour les contacts sélectionnés.",
        empty:
          "Aucune étiquette pour le moment. Créez-en une pour étiqueter les contacts sélectionnés.",
        error: "Impossible d'ajouter l'étiquette aux contacts",
        noop: "Les contacts sélectionnés ont déjà cette étiquette",
        success:
          "Étiquette ajoutée à %{smart_count} contact |||| Étiquette ajoutée à %{smart_count} contacts",
        title: "Ajouter une étiquette aux contacts",
      },
      merge: {
        action: "Fusionner avec un autre contact",
        confirm: "Fusionner les contacts",
        current_contact: "Contact actuel (sera supprimé)",
        description: "Fusionnez ce contact avec un autre.",
        error: "Échec de la fusion des contacts",
        merging: "Fusion...",
        no_additional_data: "Aucune donnée supplémentaire à fusionner",
        select_target: "Veuillez sélectionner un contact avec lequel fusionner",
        success: "Contacts fusionnés avec succès",
        target_contact: "Contact cible (sera conservé)",
        title: "Fusionner les contacts",
        warning_description:
          "Toutes les données seront transférées au deuxième contact. Cette action ne peut pas être annulée.",
        warning_title: "Avertissement : opération destructrice",
        what_will_be_merged: "Ce qui sera fusionné :",
      },
      filters: {
        before_last_month: "Avant le mois dernier",
        before_this_month: "Avant ce mois-ci",
        before_this_week: "Avant cette semaine",
        managed_by_me: "Géré par moi",
        search: "Rechercher nom, entreprise...",
        this_week: "Cette semaine",
        today: "Aujourd'hui",
        tags: "Étiquettes",
        tasks: "Tâches",
      },
      hot: {
        empty_change_status:
          'Changez le statut d\'un contact en ajoutant une note à ce contact et en cliquant sur "afficher les options".',
        empty_hint: 'Les contacts avec un statut "chaud" apparaîtront ici.',
        title: "Contacts chauds",
      },
    },
    deals: {
      name: "Affaire |||| Affaires",
      forcedCaseName: "Affaire",
      steps: {
        title: "Étapes",
        progress: "%{done}/%{total} faites",
        next_action: "Étape suivante",
        all_done: "Toutes les étapes sont faites.",
      },
      next_action: {
        "informatie-pipeline":
          "Rassembler les informations et rédiger un devis.",
        bezig: "Réaliser le travail.",
        "on-hold": "En attente - relancer dès que possible.",
        "facturatie-live": "Facturer et mettre le projet en ligne.",
        won: "Terminé.",
      },
      fields: {
        name: "Nom",
        description: "Description",
        company_id: "Entreprise",
        contact_ids: "Contacts",
        category: "Catégorie",
        amount: "Budget",
        revenue_period: "Type de revenu",
        expected_closing_date: "Date de clôture prévue",
        start_date: "Date de début",
        delivery_date: "Date de livraison",
        stage: "Étape",
      },
      action: {
        back_to_deal: "Retour à l'affaire",
        create: "Créer une affaire",
        new: "Nouvelle affaire",
      },
      field_categories: {
        misc: "Divers",
      },
      archived: {
        action: "Archiver",
        error: "Erreur : affaire non archivée",
        list_title: "Affaires archivées",
        success: "Affaire archivée",
        title: "Affaire archivée",
        view: "Afficher les affaires archivées",
      },
      moneybird: {
        estimate: {
          action: "Devis dans Moneybird",
          view: "Voir le devis dans Moneybird",
          pending: "Création du devis...",
          dialog_title: "Créer un devis Moneybird",
          dialog_description:
            "Vérifiez les informations et créez un devis brouillon dans Moneybird pour cette affaire.",
          confirm: "Créer le devis",
          warning:
            "Ceci crée un vrai devis brouillon dans votre propre administration Moneybird. Il n'est pas automatiquement envoyé au client par e-mail.",
          success: "Devis créé dans Moneybird",
          error: "Échec de la création du devis",
        },
        invoice: {
          action: "Facture dans Moneybird",
          view: "Voir la facture dans Moneybird",
          pending: "Création de la facture...",
          dialog_title: "Créer une facture Moneybird",
          dialog_description:
            "Vérifiez les informations et créez une facture brouillon dans Moneybird pour cette affaire.",
          confirm: "Créer la facture",
          warning:
            "Ceci crée une vraie facture brouillon dans votre propre administration Moneybird. Elle n'est PAS envoyée automatiquement ; envoyez-la vous-même depuis Moneybird.",
          success: "Facture créée dans Moneybird",
          error: "Échec de la création de la facture",
        },
        company: "Entreprise",
        amount: "Montant",
        no_address: "Aucune adresse connue pour cette entreprise",
        description_label: "Description sur le document",
        tax_rate: "Taux de TVA",
        tax_rate_placeholder: "Choisissez un taux de TVA",
        tax_rate_loading: "Chargement des taux...",
        no_contact_hint:
          "Aucun contact n'est lié ; le document est adressé à l'entreprise.",
        multiple_contacts_hint:
          "Plusieurs contacts sont liés ; le document est adressé à l'entreprise, pas à un contact précis.",
        warning_title: "Attention : document réel",
        no_company:
          "Cette affaire n'a pas d'entreprise liée ; liez d'abord une entreprise.",
        no_amount:
          "Cette affaire n'a pas de montant ; définissez d'abord un montant.",
        wrong_currency:
          "L'intégration Moneybird ne fonctionne qu'avec la devise EUR.",
        creating: "Création...",
        not_connected_hint:
          "Liez d'abord votre propre administration Moneybird via votre page de profil.",
      },
      inbound: {
        title: "E-mail entrant",
        description:
          "Transférez ou mettez en copie (Cc) vos e-mails à cette adresse pour les ajouter automatiquement en tant que notes sur cette affaire.",
      },
      inputs: {
        linked_to: "Lié à",
      },
      unarchived: {
        action: "Renvoyer au tableau",
        error: "Erreur : affaire non désarchivée",
        success: "Affaire désarchivée",
      },
      updated: "Affaire mise à jour",
      trello_sync: {
        action: "Synchroniser Trello",
        pending: "Synchronisation...",
        success: "Trello synchronisé : %{cards} cartes mises à jour.",
        error: "Échec de la synchronisation avec Trello",
      },

      empty: {
        before_create: "avant de créer une affaire.",
        description: "Il semble que votre liste d'affaires soit vide.",
        title: "Aucune affaire trouvée",
      },
      invalid_date: "Date invalide",
      no_date: "Pas encore planifiée",
      no_amount: "Pas encore de montant",
      filters: {
        only_mine: "Uniquement mes affaires",
      },
    },
    notes: {
      name: "Note |||| Notes",
      forcedCaseName: "Note",
      fields: {
        status: "Statut",
        date: "Date",
        attachments: "Pièces jointes",
        contact_id: "Contact",
        deal_id: "Affaire",
      },
      action: {
        add: "Ajouter une note",
        add_first: "Ajoutez votre première note",
        delete: "Supprimer la note",
        edit: "Modifier la note",
        update: "Mettre à jour la note",
        add_this: "Ajouter cette note",
      },
      sheet: {
        create: "Créer une note",
        create_for: "Créer une note pour %{name}",
        edit: "Modifier la note",
        edit_for: "Modifier la note pour %{name}",
      },
      deleted: "Note supprimée",
      empty: "Aucune note pour l'instant",
      unknown_author: "un membre de l'équipe",
      author_added: "%{name} a ajouté une note",
      you_added: "Vous avez ajouté une note",
      me: "Moi",
      list: {
        error_loading: "Erreur lors du chargement des notes",
      },
      note_for_contact: "Note pour %{name}",
      stepper: {
        hint: "Accédez à une page de contact et ajoutez une note",
      },
      added: "Note ajoutée",
      inputs: {
        add_note: "Ajouter une note",
        options_hint: "(joindre des fichiers ou modifier les détails)",
        show_options: "Afficher les options",
      },
      actions: {
        attach_document: "Joindre un document",
      },
      validation: {
        note_or_attachment_required: "Une note ou une pièce jointe est requise",
      },
    },
    sales: {
      name: "Utilisateur |||| Utilisateurs",
      fields: {
        first_name: "Prénom",
        last_name: "Nom",
        email: "E-mail",
        administrator: "Admin",
        disabled: "Désactivé",
        partij: "Partie",
      },
      create: {
        error:
          "Une erreur s'est produite lors de la création de l'utilisateur.",
        success:
          "Utilisateur créé. Ils recevront prochainement un email pour définir leur mot de passe.",
        title: "Créer un nouvel utilisateur",
      },
      edit: {
        error: "Une erreur s'est produite. Veuillez réessayer.",
        record_not_found: "Enregistrement introuvable",
        success: "Utilisateur mis à jour avec succès",
        title: "Modifier %{name}",
      },
      action: {
        new: "Nouvel utilisateur",
      },
    },
    tasks: {
      name: "Tâche |||| Tâches",
      forcedCaseName: "Tâche",
      fields: {
        text: "Description",
        due_date: "Date d'échéance",
        type: "Type",
        contact_id: "Contact",
        due_short: "échéance",
        sales_id: "Assigné à",
      },
      action: {
        add: "Ajouter une tâche",
        create: "Créer une tâche",
        edit: "Modifier la tâche",
      },
      actions: {
        postpone_next_week: "Reporté à la semaine prochaine",
        postpone_tomorrow: "Reporter à demain",
        claim: "Prendre en charge",
        title: "Actions de tâche",
      },
      added: "Tâche ajoutée",
      deleted: "Tâche supprimée avec succès",
      dialog: {
        create: "Créer une tâche",
        create_for: "Créer une tâche pour %{name}",
      },
      sheet: {
        edit: "Modifier la tâche",
        edit_for: "Modifier la tâche pour %{name}",
      },
      empty: "Aucune tâche pour l'instant",
      empty_list_hint:
        "Les tâches et étapes Trello qui vous sont attribuées apparaîtront ici.",
      filters: {
        later: "Plus tard",
        overdue: "En retard",
        this_week: "Cette semaine",
        today: "Aujourd'hui",
        tomorrow: "Demain",
        with_pending: "Avec des tâches en attente",
        mine: "Mes tâches",
        team: "Équipe",
      },
      regarding_contact: "(Concernant : %{name})",
      regarding_deal: "— %{name}",
      trello_step: "Trello",
      to_claim: "À prendre en charge",
      updated: "Tâche mise à jour",
    },
    tags: {
      name: "Étiquette |||| Étiquettes",
      action: {
        add: "Ajouter une étiquette",
        create: "Créer une nouvelle étiquette",
      },
      dialog: {
        color: "Couleur",
        create_title: "Créer une nouvelle étiquette",
        edit_title: "Modifier l'étiquette",
        name_label: "Nom de l'étiquette",
        name_placeholder: "Saisir le nom de l'étiquette",
      },
    },
  },
  crm: {
    action: {
      reset_password: "Réinitialiser le mot de passe",
    },
    auth: {
      first_name: "Prénom",
      last_name: "Nom",
      confirm_password: "Confirmer le mot de passe",
      confirmation_required:
        "Veuillez suivre le lien que nous venons de vous envoyer par email pour confirmer votre compte.",
      recovery_email_sent:
        "Si vous êtes un utilisateur enregistré, vous devriez recevoir prochainement un e-mail de récupération de mot de passe.",
      sign_in_failed: "Échec de la connexion.",
      sign_in_google_workspace: "Connectez-vous avec Google Workplace",
      signup: {
        create_account: "Créer un compte",
        create_first_user:
          "Créez le premier compte utilisateur pour terminer la configuration.",
        creating: "Création...",
        initial_user_created: "Utilisateur initial créé avec succès",
      },
      welcome_title: "Bienvenue sur %{title}",
    },
    common: {
      activity: "Activité",
      added: "ajoutée",
      details: "Détails",
      last_activity_with_date: "dernière activité %{date}",
      load_more: "Charger plus",
      misc: "Divers",
      past: "Passé",
      read_more: "En savoir plus",
      retry: "Réessayer",
      show_less: "Afficher moins",
      task_count: "%{smart_count} tâche |||| %{smart_count} tâches",
      copied: "Copié !",
      copy: "Copier",
      loading: "Chargement...",
      me: "Moi",
    },
    changelog: {
      title: "Notes de version",
    },
    activity: {
      added_company: "%{name} a ajouté l'entreprise",
      you_added_company: "Vous avez ajouté l'entreprise",
      added_contact: "%{name} a ajouté le contact",
      you_added_contact: "Vous avez ajouté le contact",
      added_note: "%{name} a ajouté une note sur",
      you_added_note: "Vous avez ajouté une note sur",
      added_note_about_deal: "%{name} a ajouté une note sur l'affaire",
      you_added_note_about_deal: "Vous avez ajouté une note sur l'affaire",
      added_deal: "%{name} a ajouté l'affaire",
      you_added_deal: "Vous avez ajouté l'affaire",
      at_company: "chez",
      to: "à",
      load_more: "Charger plus d'activité",
      someone: "un membre de l'équipe",
      today: "Aujourd'hui",
      yesterday: "Hier",
    },
    ownership: {
      you: "Vous",
      unknown: "Inconnu",
      party: {
        online_matters: "Online Matters",
        marketingbende: "Marketingbende",
        groeien_met_ads: "Groeien met Ads",
      },
      filter: {
        owner: "Propriétaire",
        all: "Tous",
        mine: "À moi",
      },
    },
    dashboard: {
      deals_chart: "Revenus des affaires à venir",
      deals_pipeline: "Pipeline des affaires",
      revenue: {
        title: "Chiffre d'affaires par mois",
        recurring: "Récurrent mensuel",
        oneoff: "Ponctuel",
        mrr_label: "Chiffre d'affaires mensuel récurrent",
        mrr_sub: "par mois, abonnements actifs",
        oneoff_label: "Chiffre d'affaires ponctuel",
        oneoff_sub: "projets ponctuels cette année",
        empty:
          "Pas encore de données de revenus. Renseignez un montant et un type (mensuel/ponctuel) sur vos affaires.",
      },
      latest_activity: "Dernière activité",
      latest_activity_error:
        "Erreur lors du chargement de la dernière activité",
      latest_notes: "Mes dernières notes",
      latest_notes_added_ago: "ajouté %{timeAgo}",
      stepper: {
        install: "Installer %{title}",
        progress: "%{step}/3 terminé",
        whats_next: "Et ensuite ?",
      },
      upcoming_tasks: "Tâches à venir",
    },
    header: {
      import_data: "Importer des données",
    },
    image_editor: {
      change: "Changer",
      drop_hint:
        "Déposez un fichier à télécharger ou cliquez pour le sélectionner.",
      editable_content: "Contenu modifiable",
      title: "Télécharger et redimensionner l'image",
      update_image: "Mettre à jour l'image",
    },
    import: {
      action: {
        download_error_report: "Téléchargez le rapport d'erreur",
        import: "Importer",
        import_another: "Importer un autre fichier",
      },
      error: {
        unable: "Impossible d'importer ce fichier.",
      },
      idle: {
        description_1:
          "Vous pouvez importer des ventes, des entreprises, des contacts, des entreprises, des notes et des tâches.",
        description_2:
          "Les données doivent se trouver dans un fichier JSON correspondant à l'exemple suivant :",
      },
      status: {
        all_success: "Tous les enregistrements ont été importés avec succès.",
        complete: "Importation terminée.",
        failed: "Échoué",
        imported: "Importé",
        in_progress: "Import en cours, veuillez ne pas quitter cette page.",
        some_failed: "Certains enregistrements n'ont pas été importés.",
        table_caption: "Statut d'importation",
      },
      title: "Importer des données",
    },
    settings: {
      about: "À propos",
      companies: {
        sectors: "Secteurs",
      },
      dark_mode_logo: "Logo du mode sombre",
      deals: {
        categories: "Catégories",
        currency: "Devise",
        pipeline_help:
          "Sélectionnez les étapes d'affaire à considérer comme des affaires dans le pipeline.",
        pipeline_statuses: "Statuts des pipelines",
        stages: "Étapes",
      },
      light_mode_logo: "Logo du mode clair",
      notes: {
        statuses: "Statuts",
      },
      reset_defaults: "Réinitialiser aux valeurs par défaut",
      save_error: "Échec de l'enregistrement de la configuration",
      saved: "Configuration enregistrée avec succès",
      saving: "Enregistrement...",
      tasks: {
        types: "Types",
      },
      preferences: "Préférences",
      title: "Paramètres",
      app_title: "Titre de l'application",
      sections: {
        branding: "Image de marque",
      },
      validation: {
        duplicate: "%{display_name} en double : %{items}",
        in_use:
          "Impossible de supprimer %{display_name} encore utilisés par des affaires : %{items}",
        validating: "Validation\u2026",
        entities: {
          categories: "catégories",
          stages: "étapes",
        },
      },
    },
    theme: {
      dark: "Sombre",
      label: "Thème",
      light: "Clair",
      system: "Système",
    },
    language: "Langue",
    navigation: {
      label: "Navigation CRM",
    },
    profile: {
      inbound: {
        description:
          "Vous pouvez commencer à envoyer des e-mails vers l'adresse de réception de votre serveur, par exemple en l'ajoutant au champ %{field}. Le CRM traitera les e-mails et ajoutera des notes aux contacts correspondants.",
        title: "E-mail entrant",
      },
      mcp: {
        title: "Serveur MCP",
        description:
          "Utilisez cette URL pour connecter votre assistant IA aux données de votre CRM via le Model Context Protocol (MCP).",
      },
      moneybird: {
        title: "Moneybird",
        description:
          "Liez votre propre administration Moneybird pour créer des devis et des factures depuis les affaires. Créez un jeton API personnel dans Moneybird (icône de profil, Paramètres, Développeurs, Créer un jeton) et collez-le ici.",
        token_label: "Jeton API personnel",
        token_help:
          "Le jeton est vérifié auprès de Moneybird et stocké chiffré. Il ne sera plus jamais affiché.",
        administration_label: "Administration",
        administration_placeholder: "Choisissez une administration",
        connect: "Lier Moneybird",
        connecting: "Liaison en cours...",
        connected: "Lié à l'administration %{administration}.",
        connect_success: "Moneybird lié à %{administration}",
        disconnect: "Délier",
        disconnect_confirm: "Oui, délier",
        disconnect_success: "Moneybird délié",
      },
      password: {
        change: "Changer le mot de passe",
      },
      password_reset_sent:
        "Un e-mail de réinitialisation du mot de passe a été envoyé à votre adresse e-mail",
      record_not_found: "Enregistrement introuvable",
      title: "Profil",
      updated: "Votre profil a été mis à jour",
      update_error: "Une erreur s'est produite. Veuillez réessayer",
    },
    validation: {
      invalid_url: "Doit être une URL valide",
      invalid_linkedin_url: "L'URL doit provenir de linkedin.com",
    },
  },
} satisfies CrmMessages;
