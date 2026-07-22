export const englishCrmMessages = {
  resources: {
    companies: {
      name: "Company |||| Companies",
      forcedCaseName: "Company",
      fields: {
        name: "Company name",
        website: "Website",
        linkedin_url: "LinkedIn URL",
        phone_number: "Phone number",
        created_at: "Created at",
        nb_contacts: "Number of contacts",
        revenue: "Revenue",
        sector: "Sector",
        size: "Size",
        tax_identifier: "Tax Identifier",
        address: "Address",
        city: "City",
        zipcode: "Zip code",
        state_abbr: "State",
        country: "Country",
        description: "Description",
        context_links: "Context links",
        sales_id: "Account manager",
      },
      empty: {
        description: "It seems your company list is empty.",
        title: "No companies found",
      },
      field_categories: {
        contact: "Contact",
        additional_info: "Additional information",
        address: "Address",
        context: "Context",
      },
      action: {
        create: "Create Company",
        edit: "Edit company",
        new: "New Company",
        show: "Show company",
      },
      added_on: "Added on %{date}",
      followed_by: "Followed by %{name}",
      followed_by_you: "Followed by you",
      no_contacts: "No contact",
      nb_contacts: "%{smart_count} contact |||| %{smart_count} contacts",
      nb_deals: "%{smart_count} deal |||| %{smart_count} deals",
      sizes: {
        one_employee: "1 employee",
        two_to_nine_employees: "2-9 employees",
        ten_to_forty_nine_employees: "10-49 employees",
        fifty_to_two_hundred_forty_nine_employees: "50-249 employees",
        two_hundred_fifty_or_more_employees: "250 or more employees",
      },
      autocomplete: {
        create_error: "An error occurred while creating the company",
        create_item: "Create %{item}",
        create_label: "Start typing to create a new company",
      },
      filters: {
        only_mine: "Only companies I manage",
      },
    },
    contacts: {
      name: "Contact |||| Contacts",
      forcedCaseName: "Contact",
      field_categories: {
        background_info: "Background info",
        identity: "Identity",
        misc: "Misc",
        personal_info: "Personal info",
        position: "Position",
      },
      fields: {
        first_name: "First name",
        last_name: "Last name",
        last_seen: "Last seen",
        title: "Title",
        company_id: "Company",
        email_jsonb: "Email addresses",
        email: "Email",
        phone_jsonb: "Phone numbers",
        phone_number: "Phone number",
        linkedin_url: "LinkedIn URL",
        background: "Background info (bio, how you met, etc)",
        has_newsletter: "Has newsletter",
        sales_id: "Account manager",
      },
      action: {
        add: "Add contact",
        add_first: "Add your first contact",
        create: "Create contact",
        edit: "Edit contact",
        export_vcard: "Export to vCard",
        new: "New Contact",
        show: "Show contact",
      },
      background: {
        last_activity_on: "Last activity on %{date}",
        added_on: "Added on %{date}",
        followed_by: "Followed by %{name}",
        followed_by_you: "Followed by you",
        status_none: "None",
      },
      position_at: "%{title} at",
      position_at_company: "%{title} at %{company}",
      empty: {
        description: "It seems your contact list is empty.",
        title: "No contacts found",
      },
      import: {
        title: "Import contacts",
        button: "Import CSV",
        complete:
          "Contacts import complete. Imported %{importCount} contacts, with %{errorCount} errors",
        progress:
          "Imported %{importCount} / %{rowCount} contacts, with %{errorCount} errors.",
        error:
          "Failed to import this file, please make sure your provided a valid CSV file.",
        imported: "Imported",
        remaining_time: "Estimated remaining time:",
        running: "The import is running, please do not close this tab.",
        sample_download: "Download CSV sample",
        sample_hint: "Here is a sample CSV file you can use as a template",
        stop: "Stop import",
        csv_file: "CSV File",
        contacts_label: "contact |||| contacts",
      },
      inputs: {
        genders: {
          male: "He/Him",
          female: "She/Her",
          nonbinary: "They/Them",
        },
        personal_info_types: {
          work: "Work",
          home: "Home",
          other: "Other",
        },
      },
      list: {
        error_loading: "Error loading contacts",
      },
      bulk_tag: {
        action: "Tag",
        back: "Back to tags",
        create_description:
          "Create a new tag and apply it to the selected contacts.",
        description:
          "Choose an existing tag or create a new one for the selected contacts.",
        empty: "No tags yet. Create one to tag the selected contacts.",
        error: "Failed to add tag to contacts",
        noop: "Selected contacts already have this tag",
        success:
          "Tag added to %{smart_count} contact |||| Tag added to %{smart_count} contacts",
        title: "Add tag to contacts",
      },
      merge: {
        action: "Merge with another contact",
        confirm: "Merge Contacts",
        current_contact: "Current Contact (will be deleted)",
        description: "Merge this contact with another one.",
        error: "Failed to merge contacts",
        merging: "Merging...",
        no_additional_data: "No additional data to merge",
        select_target: "Please select a contact to merge with",
        success: "Contacts merged successfully",
        target_contact: "Target Contact (will be kept)",
        title: "Merge Contact",
        warning_description:
          "All data will be transferred to the second contact. This action cannot be undone.",
        warning_title: "Warning: Destructive Operation",
        what_will_be_merged: "What will be merged:",
      },
      filters: {
        before_last_month: "Before last month",
        before_this_month: "Before this month",
        before_this_week: "Before this week",
        managed_by_me: "Managed by me",
        search: "Search name, company...",
        this_week: "This week",
        today: "Today",
        tags: "Tags",
        tasks: "Tasks",
      },
      hot: {
        active_deals:
          "%{smart_count} active deal |||| %{smart_count} active deals",
        empty_hint:
          "As soon as there is an active client deal, the relationship appears here automatically.",
        empty_title: "No active leads yet",
        hot_label: "Hot",
        missing_contact: "Link a contact",
        more: "%{count} more active relationships on the kanban board",
        open_board: "All leads",
        pipeline: "%{amount} pipeline",
        reasons: {
          active_delivery: "Active project",
          active_opportunity: "Open opportunity",
          closing_overdue: "Expected closing date passed",
          high_value: "High deal value",
          hot_contact: "Contact marked hot",
          multiple_deals: "Multiple active deals",
          recent_activity: "Recent activity",
          ready_to_invoice: "Ready to invoice",
          urgent_follow_up: "Follow-up today or overdue",
        },
        subtitle:
          "Automatically determined from deals, follow-up and activity.",
        tiers: {
          hot: "Hot",
          warm: "Warm",
          watch: "Watch",
        },
        title: "Hot contacts & leads",
        unnamed_contact: "Unnamed contact",
      },
    },
    deals: {
      name: "Deal |||| Deals",
      forcedCaseName: "Deal",
      completion_scope: {
        active: "Open work only",
        all: "All stages",
      },
      steps: {
        title: "Steps",
        progress: "%{done}/%{total} done",
        next_action: "Next step",
        all_done: "All steps are done.",
      },
      next_action: {
        "informatie-pipeline": "Contact the client and confirm the assignment.",
        "bevestigd-inplannen": "Schedule the work and record the next action.",
        bezig: "Carry out the work.",
        "on-hold": "Collect the missing input and monitor the follow-up date.",
        "controle-livegang": "Review, obtain approval and publish if needed.",
        "facturatie-live": "Prepare and send the invoice.",
        won: "Invoiced and completed.",
        maandelijks: "Plan and carry out the next monthly action.",
      },
      workflow: {
        overdue: "Overdue",
        today: "Today",
        next: "Next",
        plan_overdue: "Plan overdue",
        plan_next: "Plan next step",
        plan_task: "Plan task",
        plan_task_for: "Plan next task for %{name}",
        complete: "Done",
        more: "+%{count}",
      },
      fields: {
        name: "Name",
        description: "Description",
        company_id: "Company",
        contact_ids: "Contacts",
        category: "Category",
        amount: "Budget",
        amount_helper:
          "Leave blank while the total amount is still to be determined (TBD)",
        revenue_period: "One-off / recurring",
        assignee_ids: "Assigned to",
        on_hold: "On hold",
        is_internal: "Internal project",
        assignee_ids_helper: "Only assignees can see this card",
        expected_closing_date: "Deadline",
        start_date: "Start date",
        delivery_date: "Delivery date",
        duration: "Duration",
        stage: "Stage",
      },
      action: {
        back_to_deal: "Back to deal",
        create: "Create deal",
        new: "New Deal",
      },
      field_categories: {
        misc: "Misc",
      },
      archived: {
        action: "Archive",
        error: "Error: deal not archived",
        list_title: "Archived Deals",
        success: "Deal archived",
        title: "Archived Deal",
        view: "View archived deals",
      },
      moneybird: {
        estimate: {
          action: "Estimate in Moneybird",
          card_action: "Estimate",
          card_view: "Estimate",
          card_pending: "Estimate...",
          view: "View estimate in Moneybird",
          pending: "Creating estimate...",
          dialog_title: "Create Moneybird estimate",
          dialog_description:
            "Check the details and create a draft estimate in Moneybird for this deal.",
          confirm: "Create estimate",
          warning:
            "This creates a real draft estimate in your own Moneybird administration. It is not automatically emailed to the client.",
          success: "Estimate created in Moneybird",
          error: "Failed to create the estimate",
        },
        invoice: {
          action: "Invoice in Moneybird",
          card_action: "Invoice",
          card_view: "Invoice",
          card_pending: "Invoice...",
          view: "View invoice in Moneybird",
          pending: "Creating invoice...",
          dialog_title: "Create Moneybird invoice",
          dialog_description:
            "Check the details and create a draft invoice in Moneybird for this deal.",
          confirm: "Create invoice",
          warning:
            "This creates a real draft invoice in your own Moneybird administration. It is NOT sent automatically; send it yourself from Moneybird.",
          success: "Invoice created in Moneybird",
          error: "Failed to create the invoice",
        },
        company: "Company",
        amount: "Amount (excl. VAT)",
        no_address: "No address known for this company",
        description_label: "Description on the document",
        description_helper:
          "Only this customer-facing text is sent to Moneybird; internal card notes are not copied.",
        tax_rate: "VAT rate",
        tax_rate_placeholder: "Choose a VAT rate",
        tax_rate_loading: "Loading rates...",
        tax_rate_error:
          "The VAT rates could not be loaded. Check your Moneybird connection on your profile page and try again.",
        tax_rate_retry: "Try again",
        no_contact_hint:
          "No contact is linked; the document goes to the company.",
        multiple_contacts_hint:
          "Multiple contacts are linked; the document goes to the company, not a specific contact.",
        warning_title: "Note: real document",
        no_company: "This deal has no linked company; link a company first.",
        no_amount:
          "The total amount is still to be determined (TBD). Open the deal, choose Edit and enter the confirmed amount first.",
        wrong_currency:
          "The Moneybird integration only works with the EUR currency.",
        creating: "Creating...",
        not_connected_hint:
          "Link your own Moneybird administration on your profile page first.",
      },
      inbound: {
        title: "Inbound email",
        description:
          "Forward or Cc emails to this address to automatically add them as notes on this deal.",
      },
      inputs: {
        linked_to: "Linked to",
      },
      unarchived: {
        action: "Send back to the board",
        error: "Error: deal not unarchived",
        success: "Deal unarchived",
      },
      updated: "Deal updated",
      scope: {
        all: "Everything",
        internal: "Internal",
        external: "External",
      },
      trello_sync: {
        action: "Sync Trello",
        pending: "Syncing...",
        stage_summary:
          "Unconfirmed %{new_count} · Confirmed %{confirmed_count} · Waiting %{hold_count} · Active %{active_count} · Review %{review_count} · To invoice %{live_count} · Completed %{won_count} · Monthly %{monthly_count}",
        success:
          "Trello synced: %{smart_count} card in %{duration}. %{stage_summary} |||| Trello synced: %{smart_count} cards in %{duration}. %{stage_summary}",
        partial:
          "Trello partly synced in %{duration}: %{synced} active cards processed. %{failed_count} failed (%{failed_names}). %{stage_summary}",
        error: "Failed to sync with Trello",
      },

      empty: {
        before_create: "before creating a deal.",
        description: "It seems your deal list is empty.",
        title: "No deals found",
      },
      invalid_date: "Invalid date",
      no_date: "Not scheduled yet",
      duration_days: "%{smart_count} day |||| %{smart_count} days",
      no_amount: "TBD",
      per_month_suffix: "/mo",
      move_error:
        "The deal could not be moved. The board has been restored to the saved state.",
      partial_load: "Showing %{loaded} of %{total} deals.",
      revenue_period_options: {
        maandelijks: "Monthly recurring",
        eenmalig: "One-off",
      },
      filters: {
        only_mine: "Only my deals",
      },
    },
    notes: {
      name: "Note |||| Notes",
      forcedCaseName: "Note",
      fields: {
        status: "Status",
        date: "Date",
        attachments: "Attachments",
        contact_id: "Contact",
        deal_id: "Deal",
      },
      action: {
        add: "Add note",
        add_first: "Add your first note",
        delete: "Delete note",
        edit: "Edit note",
        update: "Update note",
        add_this: "Add this note",
      },
      sheet: {
        create: "Create note",
        create_for: "Create note for %{name}",
        edit: "Edit note",
        edit_for: "Edit note for %{name}",
      },
      deleted: "Note deleted",
      empty: "No notes yet",
      unknown_author: "a team member",
      author_added: "%{name} added a note",
      you_added: "You added a note",
      me: "Me",
      list: {
        error_loading: "Error loading notes",
      },
      note_for_contact: "Note for %{name}",
      stepper: {
        hint: "Go to a contact page and add a note",
      },
      added: "Note added",
      inputs: {
        add_note: "Add a note",
        options_hint: "(attach files, or change details)",
        show_options: "Show options",
      },
      actions: {
        attach_document: "Attach document",
      },
      validation: {
        note_or_attachment_required: "A note or an attachment is required",
      },
    },
    sales: {
      name: "User |||| Users",
      fields: {
        first_name: "First name",
        last_name: "Last name",
        email: "Email",
        administrator: "Admin",
        disabled: "Disabled",
        partij: "Party",
        hourly_rate: "Hourly rate (excl. VAT)",
        hourly_rate_helper:
          "Personal rate; leave blank while it is still to be determined (TBD)",
        hourly_rate_invalid: "Enter a valid non-negative hourly rate",
      },
      create: {
        error: "An error occurred while creating the user.",
        success:
          "User created. They will soon receive an email to set their password.",
        title: "Create a new user",
      },
      edit: {
        error: "An error occurred. Please try again.",
        record_not_found: "Record not found",
        success: "User updated successfully",
        title: "Edit %{name}",
      },
      action: {
        new: "New user",
      },
    },
    tasks: {
      name: "Task |||| Tasks",
      forcedCaseName: "Task",
      trello_text_readonly:
        "This step comes from Trello. Edit the description in Trello; changes here are overwritten on the next sync.",
      fields: {
        text: "Description",
        due_date: "Due date",
        type: "Type",
        contact_id: "Contact",
        due_short: "due",
        sales_id: "Assigned to",
      },
      action: {
        add: "Add task",
        create: "Create task",
        edit: "Edit task",
      },
      actions: {
        postpone_next_week: "Postpone to next week",
        postpone_tomorrow: "Postpone to tomorrow",
        claim: "Pick up",
        title: "task actions",
      },
      added: "Task added",
      deleted: "Task deleted successfully",
      dialog: {
        create: "Create task",
        create_for: "Create task for %{name}",
      },
      sheet: {
        edit: "Edit task",
        edit_for: "Edit task for %{name}",
      },
      empty: "No tasks yet",
      empty_list_hint:
        "Tasks and Trello steps assigned to you will appear here.",
      filters: {
        later: "Later",
        overdue: "Overdue",
        this_week: "This week",
        today: "Today",
        tomorrow: "Tomorrow",
        with_pending: "With pending tasks",
        mine: "My tasks",
        team: "Team",
      },
      regarding_contact: "(Re: %{name})",
      regarding_deal: "— %{name}",
      trello_step: "Trello",
      to_claim: "To pick up",
      updated: "Task updated",
    },
    tags: {
      name: "Tag |||| Tags",
      action: {
        add: "Add tag",
        create: "Create new tag",
      },
      dialog: {
        color: "Color",
        create_title: "Create a new tag",
        edit_title: "Edit tag",
        name_label: "Tag name",
        name_placeholder: "Enter tag name",
      },
    },
  },
  crm: {
    action: {
      reset_password: "Reset Password",
    },
    auth: {
      first_name: "First name",
      last_name: "Last name",
      confirm_password: "Confirm password",
      link_expired:
        "The link has expired or is invalid. Please request a new one.",
      confirmation_required:
        "Please follow the link we just sent you by email to confirm your account.",
      recovery_email_sent:
        "If you're a registered user, you should receive a password recovery email shortly.",
      hide_password: "Hide password",
      show_password: "Show password",
      sign_in_failed: "Failed to log in.",
      sign_in_google_workspace: "Sign in with Google Workspace",
      signing_in: "Signing in...",
      signup: {
        create_account: "Create account",
        create_first_user:
          "Create the first user account to complete the setup.",
        creating: "Creating...",
        initial_user_created: "Initial user successfully created",
      },
      welcome_title: "Welcome to %{title}",
    },
    common: {
      activity: "Activity",
      added: "added",
      details: "Details",
      last_activity_with_date: "last activity %{date}",
      load_more: "Load more",
      misc: "Misc",
      past: "Past",
      read_more: "Read more",
      retry: "Retry",
      show_less: "Show less",
      copied: "Copied!",
      copy: "Copy",
      open_gmail_with_bcc: "Open Gmail with CRM address in Bcc",
      loading: "Loading...",
      me: "Me",
      task_count: "%{smart_count} task |||| %{smart_count} tasks",
    },
    changelog: {
      title: "Changelog",
    },
    activity: {
      added_company: "%{name} added company",
      you_added_company: "You added company",
      added_contact: "%{name} added",
      you_added_contact: "You added",
      added_note: "%{name} added a note about",
      you_added_note: "You added a note about",
      added_note_about_deal: "%{name} added a note about deal",
      you_added_note_about_deal: "You added a note about deal",
      added_deal: "%{name} added deal",
      you_added_deal: "You added deal",
      at_company: "at",
      to: "to",
      load_more: "Load more activity",
      open_item: "Open",
      someone: "a team member",
      trello: "Trello",
      trello_attachment: "Trello attachment",
      today: "Today",
      yesterday: "Yesterday",
    },
    ownership: {
      you: "You",
      unknown: "Unknown",
      party: {
        online_matters: "Online Matters",
        marketingbende: "Marketingbende",
        groeien_met_ads: "Groeien met Ads",
      },
      filter: {
        owner: "Owner",
        all: "All",
        mine: "Mine",
      },
    },
    dashboard: {
      deals_pipeline: "Deals Pipeline",
      deal_actions: {
        title: "This needs your attention",
        subtitle:
          "Exceptions only: overdue, due today, expired or not yet planned.",
        open_board: "Kanban",
        empty_title: "Everything is under control",
        empty: "There are no overdue or unplanned deals.",
        next_task: "Next task",
        recommended_action: "Recommended next step",
        summary: "Attention summary",
        counts: {
          overdue: "%{count} overdue",
          today: "%{count} today",
          planning: "%{count} plans expired",
          unplanned: "%{count} without a plan",
        },
        more: "%{count} more attention items on the kanban board",
      },
      revenue: {
        title: "Revenue per month",
        recurring: "Monthly recurring",
        oneoff: "One-off",
        mrr_label: "Monthly recurring revenue",
        mrr_sub: "per month, active subscriptions",
        oneoff_label: "One-off revenue",
        oneoff_sub: "one-off projects this year",
        forecast: "Forecast (expected)",
        forecast_label: "Expected revenue",
        forecast_sub: "open deals, weighted by stage",
        empty:
          "No revenue data yet. Set an amount and type (monthly/one-off) on your deals.",
      },
      latest_activity: "Latest Activity",
      latest_activity_error: "Error loading latest activity",
      latest_notes: "My Latest Notes",
      latest_notes_added_ago: "added %{timeAgo}",
      stepper: {
        install: "Install %{title}",
        progress: "%{step}/3 done",
        whats_next: "What's next?",
      },
      upcoming_tasks: "Upcoming Tasks",
    },
    header: {
      import_data: "Import data",
    },
    image_editor: {
      change: "Change",
      drop_hint: "Drop a file to upload, or click to select it.",
      editable_content: "Editable content",
      title: "Upload and resize image",
      update_image: "Update Image",
    },
    import: {
      action: {
        download_error_report: "Download the error report",
        import: "Import",
        import_another: "Import another file",
      },
      error: {
        unable: "Unable to import this file.",
      },
      idle: {
        description_1:
          "You can import sales, companies, contacts, companies, notes, and tasks.",
        description_2:
          "Data must be in a JSON file matching the following sample:",
      },
      status: {
        all_success: "All records were imported successfully.",
        complete: "Import complete.",
        failed: "Failed",
        imported: "Imported",
        in_progress:
          "Import in progress, please don't navigate away from this page.",
        some_failed: "Some records were not imported.",
        table_caption: "Import status",
      },
      title: "Import Data",
    },
    settings: {
      about: "About",
      companies: {
        sectors: "Sectors",
      },
      dark_mode_logo: "Dark Mode Logo",
      deals: {
        categories: "Categories",
        currency: "Currency",
        pipeline_help:
          "Select which deal stages should count as pipeline deals.",
        pipeline_statuses: "Pipeline Statuses",
        stages: "Stages",
      },
      light_mode_logo: "Light Mode Logo",
      notes: {
        statuses: "Statuses",
      },
      reset_defaults: "Reset to Defaults",
      save_error: "Failed to save configuration",
      saved: "Configuration saved successfully",
      saving: "Saving...",
      tasks: {
        types: "Types",
      },
      preferences: "Preferences",
      title: "Settings",
      app_title: "App Title",
      sections: {
        branding: "Branding",
      },
      validation: {
        duplicate: "Duplicate %{display_name}: %{items}",
        in_use:
          "Cannot remove %{display_name} that are still used by deals: %{items}",
        validating: "Validating\u2026",
        entities: {
          categories: "categories",
          stages: "stages",
        },
      },
    },
    theme: {
      dark: "Dark",
      label: "Theme",
      light: "Light",
      system: "System",
    },
    language: "Language",
    navigation: {
      label: "CRM navigation",
    },
    profile: {
      gmail: {
        title: "Gmail",
        description:
          "Connect your Gmail account directly. Only email with your selected Gmail label is linked to existing CRM relations; BCC remains available as an explicit fallback.",
        connect: "Connect Gmail",
        connecting: "Opening Google…",
        connect_success:
          "Gmail is connected. Choose a Gmail label before import becomes active.",
        oauth_error:
          "Gmail connection was not completed. Try again or check the Google consent screen.",
        connected: "Connected to %{email}.",
        last_sync: "Last synchronization: %{date}",
        not_synced: "not run yet",
        sync: "Synchronize now",
        syncing: "Synchronizing…",
        sync_success: "%{count} Gmail messages processed",
        sync_error: "Synchronization problem: %{error}",
        sync_label: "Gmail label for CRM import",
        sync_label_description:
          "Only messages you explicitly give this label are processed. Gmail never creates contacts, companies, or deals automatically.",
        sync_label_placeholder: "Choose, for example, CRM",
        sync_label_loading: "Loading Gmail labels…",
        sync_label_empty:
          "No custom Gmail label found yet. Create a label such as ‘CRM’ in Gmail and refresh this page.",
        sync_label_hint:
          "Import new or existing mail deliberately by adding the label after activation. Unmatched mail is never created as a deal.",
        sync_label_save: "Activate import",
        sync_label_saving: "Saving…",
        sync_label_success: "Gmail import is limited to label ‘%{label}’.",
        sync_label_active: "Import label: %{label}.",
        sync_label_required: "Import is paused until you choose a Gmail label.",
        disconnect: "Disconnect",
        disconnect_confirm: "Yes, disconnect Gmail",
        disconnect_success: "Gmail disconnected",
      },
      inbound: {
        description:
          "You can start sending emails to your server's inbound email address, e.g. by adding it to the %{field} field. The CRM will process the emails and add notes to the corresponding contacts.",
        title: "Inbound email",
      },
      mcp: {
        title: "MCP Server",
        description:
          "Use this URL to connect your AI assistant to your CRM data via the Model Context Protocol (MCP).",
      },
      moneybird: {
        title: "Moneybird",
        description:
          "Link your own Moneybird administration to create estimates and invoices from deals. Create a personal API token in Moneybird (profile icon, Settings, Developers, Create token) and paste it here.",
        token_label: "Personal API token",
        token_help:
          "The token is validated with Moneybird and stored encrypted. It is never shown again.",
        administration_label: "Administration",
        administration_placeholder: "Choose an administration",
        connect: "Link Moneybird",
        connecting: "Linking...",
        connected: "Linked to administration %{administration}.",
        connect_success: "Moneybird linked to %{administration}",
        disconnect: "Unlink",
        disconnect_confirm: "Yes, unlink",
        disconnect_success: "Moneybird unlinked",
      },
      password: {
        change: "Change password",
      },
      password_reset_sent:
        "A reset password email has been sent to your email address",
      password_reset_error:
        "The password reset email could not be sent. Please try again.",
      record_not_found: "Record not found",
      title: "Profile",
      updated: "Your profile has been updated",
      update_error: "An error occurred. Please try again",
    },
    validation: {
      invalid_url: "Must be a valid URL",
      invalid_linkedin_url: "URL must be from linkedin.com",
    },
  },
} as const;

type MessageSchema<T> = {
  [K in keyof T]: T[K] extends string
    ? string
    : T[K] extends Record<string, unknown>
      ? MessageSchema<T[K]>
      : never;
};

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Record<string, unknown>
    ? DeepPartial<T[K]>
    : T[K];
};

export type CrmMessages = MessageSchema<typeof englishCrmMessages>;
export type PartialCrmMessages = DeepPartial<CrmMessages>;
