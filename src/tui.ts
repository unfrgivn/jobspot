#!/usr/bin/env bun
import {
  createCliRenderer,
  BoxRenderable,
  TextRenderable,
  SelectRenderable,
  SelectRenderableEvents,
  InputRenderable,
  InputRenderableEvents,
  TextareaRenderable,
} from "@opentui/core";
import { existsSync } from "fs";
import { join } from "path";
import { spawnSync } from "child_process";
import { initWorkspace } from "./commands/init";
import { runDoctor } from "./commands/doctor";
import { addRole } from "./commands/add";
import { applyToRole } from "./commands/apply";
import { getReviewData } from "./commands/review";
import { findRoot, dbPath } from "./workspace";
import { getDb } from "./db";
import { getUserProfile } from "./db/user_profile";

type Screen = "main" | "pipeline" | "add-role" | "role-actions" | "profile" | "doctor" | "review" | "paste-jd";

interface AppState {
  screen: Screen;
  workspaceReady: boolean;
  roles: RoleRow[];
  selectedRoleId: string | null;
  message: string;
}

interface RoleRow {
  id: string;
  title: string;
  company_name: string;
  status: string | null;
  url: string | null;
}

const state: AppState = {
  screen: "main",
  workspaceReady: false,
  roles: [],
  selectedRoleId: null,
  message: "",
};

async function main() {
  const renderer = await createCliRenderer({
    targetFps: 30,
    exitOnCtrlC: true,
  });

  checkWorkspace();

  const container = new BoxRenderable(renderer, {
    id: "container",
    flexDirection: "column",
    width: "100%",
    height: "100%",
    backgroundColor: "#13141c",
  });
  renderer.root.add(container);

  const header = new BoxRenderable(renderer, {
    id: "header",
    width: "100%",
    height: 3,
    backgroundColor: "#1f2335",
    border: false,
    padding: 0,
  });

  const headerText = new TextRenderable(renderer, {
    id: "header-text",
    content: "JobSearch Agent",
    position: "absolute",
    left: 2,
    top: 1,
    fg: "#bb9af7",
  });
  header.add(headerText);
  container.add(header);

  const content = new BoxRenderable(renderer, {
    id: "content",
    flexGrow: 1,
    width: "100%",
    padding: 0,
    justifyContent: "center",
    alignItems: "center",
  });
  container.add(content);

  const statusBar = new BoxRenderable(renderer, {
    id: "status-bar",
    width: "100%",
    height: 1,
    backgroundColor: "#1f2335",
  });

  const statusText = new TextRenderable(renderer, {
    id: "status-text",
    content: "Press 'q' to quit",
    position: "absolute",
    left: 1,
    top: 0,
    fg: "#565f89",
  });
  statusBar.add(statusText);
  container.add(statusBar);

  const messageText = new TextRenderable(renderer, {
    id: "message",
    content: "",
    position: "absolute",
    left: 30,
    top: 0,
    fg: "#7aa2f7",
  });
  statusBar.add(messageText);

  function showMessage(msg: string) {
    state.message = msg;
    messageText.content = msg;
  }

  function clearContent() {
    const children = [...content.getChildren()];
    for (const child of children) {
      content.remove(child.id);
    }
  }

  function openInVim(filePath: string) {
    renderer.suspend();
    const editor = process.env.VISUAL || process.env.EDITOR || "vim";
    spawnSync(editor, [filePath], {
      stdio: "inherit",
    });
    renderer.resume();
    renderProfile();
  }

  function renderMainMenu() {
    clearContent();
    state.screen = "main";

    const menuBox = new BoxRenderable(renderer, {
      id: "main-menu-box",
      width: 60,
      backgroundColor: "#1f2335",
      border: false,
      flexDirection: "column",
      padding: 2,
    });

    const menuHeader = new TextRenderable(renderer, {
      id: "menu-header",
      content: "Main Menu\n",
      fg: "#bb9af7",
    });
    menuBox.add(menuHeader);

    const menuOptions = [];

    if (!state.workspaceReady) {
      menuOptions.push({ name: "Initialize", description: "Set up workspace in current directory" });
    }

    menuOptions.push(
      { name: "Pipeline", description: "View and manage job applications" },
      { name: "Add Role", description: "Add a new job to track" },
      { name: "Review", description: "Weekly review and tasks" },
      { name: "Profile", description: "Manage your profile and resume" },
      { name: "Doctor", description: "Check system configuration" },
      { name: "Quit", description: "Exit the application" }
    );

    const menu = new SelectRenderable(renderer, {
      id: "main-menu",
      width: "100%",
      height: menuOptions.length * 2 + 1,
      options: menuOptions,
      backgroundColor: "#1f2335",
      textColor: "#c0caf5",
      focusedBackgroundColor: "#1f2335",
      focusedTextColor: "#c0caf5",
      selectedBackgroundColor: "#7aa2f7",
      selectedTextColor: "#13141c",
      descriptionColor: "#565f89",
      selectedDescriptionColor: "#13141c",
    });

    menu.on(SelectRenderableEvents.ITEM_SELECTED, async () => {
      const option = menu.getSelectedOption();
      if (!option) return;

      switch (option.name) {
        case "Initialize":
          await initWorkspace();
          checkWorkspace();
          showMessage("Workspace initialized!");
          renderMainMenu();
          break;
        case "Pipeline":
          renderPipeline();
          break;
        case "Add Role":
          renderAddRole();
          break;
        case "Review":
          renderReview();
          break;
        case "Profile":
          renderProfile();
          break;
        case "Doctor":
          await renderDoctor();
          break;
        case "Quit":
          renderer.destroy();
          process.exit(0);
      }
    });

    menuBox.add(menu);
    content.add(menuBox);
    menu.focus();
  }

  function renderPipeline() {
    if (!state.workspaceReady) {
      showMessage("Initialize workspace first");
      return;
    }

    clearContent();
    state.screen = "pipeline";
    loadRoles();

    const pipelineBox = new BoxRenderable(renderer, {
      id: "pipeline-box",
      width: "100%",
      height: "100%",
      backgroundColor: "#13141c",
      border: false,
      flexDirection: "column",
    });

    const pipelineHeader = new TextRenderable(renderer, {
      id: "pipeline-header",
      content: "Pipeline (ESC to go back)",
      fg: "#bb9af7",
    });
    pipelineBox.add(pipelineHeader);

    if (state.roles.length === 0) {
      const emptyText = new TextRenderable(renderer, {
        id: "empty-text",
        content: "No roles yet. Press ESC and select 'Add Role'.",
        fg: "#565f89",
      });
      pipelineBox.add(emptyText);
    } else {
      const roleOptions = state.roles.map((r) => ({
        name: `${r.company_name} - ${r.title}`,
        description: `Status: ${r.status || "wishlist"}`,
      }));

      const roleList = new SelectRenderable(renderer, {
        id: "role-list",
        width: "100%",
        height: Math.min(state.roles.length * 2 + 1, 20),
        options: roleOptions,
        backgroundColor: "#13141c",
        textColor: "#c0caf5",
        focusedBackgroundColor: "#13141c",
        focusedTextColor: "#c0caf5",
        selectedBackgroundColor: "#7aa2f7",
        selectedTextColor: "#13141c",
        descriptionColor: "#565f89",
        selectedDescriptionColor: "#13141c",
      });

      roleList.on(SelectRenderableEvents.ITEM_SELECTED, () => {
        const idx = roleList.getSelectedIndex();
        const role = state.roles[idx];
        if (!role) return;
        state.selectedRoleId = role.id;
        renderRoleActions();
      });

      pipelineBox.add(roleList);
      roleList.focus();
    }

    content.add(pipelineBox);
  }

  function renderRoleActions() {
    clearContent();
    state.screen = "role-actions";

    const role = state.roles.find((r) => r.id === state.selectedRoleId);
    if (!role) {
      renderPipeline();
      return;
    }

    const actionBox = new BoxRenderable(renderer, {
      id: "action-box",
      width: 60,
      backgroundColor: "#1f2335",
      border: false,
      flexDirection: "column",
      padding: 2,
    });

    const actionHeader = new TextRenderable(renderer, {
      id: "action-header",
      content: `${role.company_name} - ${role.title}\n`,
      fg: "#bb9af7",
    });
    actionBox.add(actionHeader);

    const actions = new SelectRenderable(renderer, {
      id: "role-actions",
      width: "100%",
      height: 8,
      options: [
        { name: "Apply", description: "Generate cover letter and apply" },
        { name: "Paste JD", description: "Paste job description" },
        { name: "Edit Role", description: "Edit company, title, or URL" },
        { name: "Back", description: "Return to pipeline" },
      ],
      backgroundColor: "#1f2335",
      textColor: "#c0caf5",
      focusedBackgroundColor: "#1f2335",
      focusedTextColor: "#c0caf5",
      selectedBackgroundColor: "#7aa2f7",
      selectedTextColor: "#13141c",
      descriptionColor: "#565f89",
      selectedDescriptionColor: "#13141c",
    });

    actions.on(SelectRenderableEvents.ITEM_SELECTED, async () => {
      const option = actions.getSelectedOption();
      if (!option) return;

      switch (option.name) {
        case "Apply":
          await handleApply(role.id);
          break;
        case "Paste JD":
          renderPasteJd(role.id);
          break;
        case "Edit Role":
          renderEditRole(role.id);
          break;
        case "Back":
          renderPipeline();
          break;
      }
    });

    actionBox.add(actions);
    content.add(actionBox);
    actions.focus();
  }

  function renderPasteJd(roleId: string) {
    clearContent();
    state.screen = "paste-jd";

    const role = state.roles.find((r) => r.id === roleId);
    if (!role) {
      renderPipeline();
      return;
    }

    const modalContainer = new BoxRenderable(renderer, {
      id: "paste-jd-container",
      width: "100%",
      height: "100%",
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "#13141c",
    });

    const modalBox = new BoxRenderable(renderer, {
      id: "paste-jd-modal",
      width: 80,
      height: 20,
      backgroundColor: "#1a1b26",
      border: true,
      borderColor: "#bb9af7",
      flexDirection: "column",
      padding: 1,
    });

    const modalHeader = new TextRenderable(renderer, {
      id: "paste-jd-header",
      content: `Paste Job Description`,
      fg: "#bb9af7",
    });
    modalBox.add(modalHeader);

    const roleInfo = new TextRenderable(renderer, {
      id: "paste-jd-role-info",
      content: `${role.company_name} - ${role.title}\n`,
      fg: "#565f89",
    });
    modalBox.add(roleInfo);

    const jdTextarea = new TextareaRenderable(renderer, {
      id: "paste-jd-textarea",
      width: "100%",
      height: 12,
      placeholder: "Paste the full job description here...",
      backgroundColor: "#1f2335",
      textColor: "#c0caf5",
      focusedBackgroundColor: "#1f2335",
      focusedTextColor: "#c0caf5",
    });
    modalBox.add(jdTextarea);

    const hintsBox = new BoxRenderable(renderer, {
      id: "paste-jd-hints",
      width: "100%",
      height: 1,
      flexDirection: "row",
      justifyContent: "center",
      gap: 2,
    });

    const escHint = new TextRenderable(renderer, {
      id: "hint-esc",
      content: "ESC",
      fg: "#7aa2f7",
    });
    hintsBox.add(escHint);

    const escLabel = new TextRenderable(renderer, {
      id: "hint-esc-label",
      content: "cancel",
      fg: "#565f89",
    });
    hintsBox.add(escLabel);

    const submitHint = new TextRenderable(renderer, {
      id: "hint-submit",
      content: "Ctrl+D",
      fg: "#7aa2f7",
    });
    hintsBox.add(submitHint);

    const submitLabel = new TextRenderable(renderer, {
      id: "hint-submit-label",
      content: "save",
      fg: "#565f89",
    });
    hintsBox.add(submitLabel);

    modalBox.add(hintsBox);
    modalContainer.add(modalBox);
    content.add(modalContainer);

    jdTextarea.focus();

    const handlePasteJdKey = (key: { name: string; ctrl?: boolean }) => {
      if (state.screen !== "paste-jd") return;

      if (key.ctrl && key.name === "d") {
        const jdText = jdTextarea.plainText?.trim();
        if (!jdText) {
          showMessage("Job description cannot be empty");
          return;
        }

        try {
          const root = findRoot();
          const db = getDb(dbPath(root));
          db.run("UPDATE roles SET jd_text = ? WHERE id = ?", [jdText, roleId]);
          showMessage("Job description saved!");
          state.selectedRoleId = roleId;
          renderRoleActions();
        } catch (err) {
          showMessage(`Error saving JD: ${err}`);
        }
      }
    };

    renderer.keyInput.on("keypress", handlePasteJdKey);
  }

  function renderEditRole(roleId: string) {
    const role = state.roles.find((r) => r.id === roleId);
    if (!role) {
      renderPipeline();
      return;
    }

    clearContent();
    state.screen = "add-role";

    const formBox = new BoxRenderable(renderer, {
      id: "edit-role-box",
      width: 60,
      backgroundColor: "#1f2335",
      border: false,
      flexDirection: "column",
      padding: 2,
      gap: 1,
    });

    const formHeader = new TextRenderable(renderer, {
      id: "form-header",
      content: "Edit Role (ESC to cancel)\n",
      fg: "#bb9af7",
    });
    formBox.add(formHeader);

    const companyLabel = new TextRenderable(renderer, {
      id: "company-label",
      content: "Company:",
      fg: "#c0caf5",
    });
    formBox.add(companyLabel);

    const companyInput = new InputRenderable(renderer, {
      id: "company-input",
      width: "100%",
      height: 1,
      backgroundColor: "#1f2335",
      textColor: "#c0caf5",
      focusedBackgroundColor: "#1a1b26",
      focusedTextColor: "#7aa2f7",
      placeholderColor: "#565f89",
      cursorColor: "#7aa2f7",
      onPaste(event) {
        this.insertText(event.text);
      },
    });
    companyInput.value = role.company_name;
    formBox.add(companyInput);

    const titleLabel = new TextRenderable(renderer, {
      id: "title-label",
      content: "Job Title:",
      fg: "#c0caf5",
    });
    formBox.add(titleLabel);

    const titleInput = new InputRenderable(renderer, {
      id: "title-input",
      width: "100%",
      height: 1,
      backgroundColor: "#1f2335",
      textColor: "#c0caf5",
      focusedBackgroundColor: "#1a1b26",
      focusedTextColor: "#7aa2f7",
      placeholderColor: "#565f89",
      cursorColor: "#7aa2f7",
      onPaste(event) {
        this.insertText(event.text);
      },
    });
    titleInput.value = role.title;
    formBox.add(titleInput);

    const urlLabel = new TextRenderable(renderer, {
      id: "url-label",
      content: "Job URL:",
      fg: "#c0caf5",
    });
    formBox.add(urlLabel);

    const urlInput = new InputRenderable(renderer, {
      id: "url-input",
      width: "100%",
      height: 1,
      backgroundColor: "#1f2335",
      textColor: "#c0caf5",
      focusedBackgroundColor: "#1a1b26",
      focusedTextColor: "#7aa2f7",
      placeholderColor: "#565f89",
      cursorColor: "#7aa2f7",
      onPaste(event) {
        this.insertText(event.text);
      },
    });
    urlInput.value = role.url || "";
    formBox.add(urlInput);

    const submitHint = new TextRenderable(renderer, {
      id: "submit-hint",
      content: "\nTab: switch fields | Enter: save | ESC: cancel",
      fg: "#565f89",
    });
    formBox.add(submitHint);

    content.add(formBox);

    const inputs = [companyInput, titleInput, urlInput];
    let currentInputIdx = 0;
    companyInput.focus();

    function saveChanges() {
      const company = companyInput.value?.trim();
      const title = titleInput.value?.trim();
      const url = urlInput.value?.trim() || null;

      if (!company) {
        showMessage("Company name is required");
        return;
      }
      if (!title) {
        showMessage("Job title is required");
        return;
      }

      try {
        const root = findRoot();
        const db = getDb(dbPath(root));
        
        const roleRow = db.prepare<{ company_id: string }, [string]>(
          "SELECT company_id FROM roles WHERE id = ?"
        ).get(roleId);
        
        if (roleRow) {
          db.run("UPDATE companies SET name = ? WHERE id = ?", [company, roleRow.company_id]);
        }
        db.run("UPDATE roles SET title = ?, job_url = ? WHERE id = ?", [title, url, roleId]);
        
        loadRoles();
        showMessage("Role updated!");
        state.selectedRoleId = roleId;
        renderRoleActions();
      } catch (err) {
        showMessage(`Error: ${err}`);
      }
    }

    for (const input of inputs) {
      input.on(InputRenderableEvents.ENTER, () => {
        saveChanges();
      });
    }

    renderer.keyInput.on("keypress", (key: { name: string; shift?: boolean }) => {
      if (state.screen !== "add-role") return;

      if (key.name === "tab") {
        currentInputIdx = key.shift
          ? (currentInputIdx - 1 + inputs.length) % inputs.length
          : (currentInputIdx + 1) % inputs.length;
        inputs[currentInputIdx]?.focus();
      }
    });
  }

  function renderAddRole() {
    if (!state.workspaceReady) {
      showMessage("Initialize workspace first");
      return;
    }

    clearContent();
    state.screen = "add-role";

    const formBox = new BoxRenderable(renderer, {
      id: "add-role-box",
      width: 60,
      backgroundColor: "#1f2335",
      border: false,
      flexDirection: "column",
      padding: 2,
      gap: 1,
    });

    const formHeader = new TextRenderable(renderer, {
      id: "form-header",
      content: "Add New Role (ESC to cancel)\n",
      fg: "#bb9af7",
    });
    formBox.add(formHeader);

    const companyLabel = new TextRenderable(renderer, {
      id: "company-label",
      content: "Company:",
      fg: "#c0caf5",
    });
    formBox.add(companyLabel);

    const companyInput = new InputRenderable(renderer, {
      id: "company-input",
      width: "100%",
      height: 1,
      placeholder: "Company name",
      backgroundColor: "#1f2335",
      textColor: "#c0caf5",
      focusedBackgroundColor: "#1a1b26",
      focusedTextColor: "#7aa2f7",
      placeholderColor: "#565f89",
      cursorColor: "#7aa2f7",
      onPaste(event) {
        this.insertText(event.text);
      },
    });
    formBox.add(companyInput);

    const titleLabel = new TextRenderable(renderer, {
      id: "title-label",
      content: "Job Title:",
      fg: "#c0caf5",
    });
    formBox.add(titleLabel);

    const titleInput = new InputRenderable(renderer, {
      id: "title-input",
      width: "100%",
      height: 1,
      placeholder: "VP of Engineering",
      backgroundColor: "#1f2335",
      textColor: "#c0caf5",
      focusedBackgroundColor: "#1a1b26",
      focusedTextColor: "#7aa2f7",
      placeholderColor: "#565f89",
      cursorColor: "#7aa2f7",
      onPaste(event) {
        this.insertText(event.text);
      },
    });
    formBox.add(titleInput);

    const urlLabel = new TextRenderable(renderer, {
      id: "url-label",
      content: "Job URL:",
      fg: "#c0caf5",
    });
    formBox.add(urlLabel);

    const urlInput = new InputRenderable(renderer, {
      id: "url-input",
      width: "100%",
      height: 1,
      placeholder: "https://...",
      backgroundColor: "#1f2335",
      textColor: "#c0caf5",
      focusedBackgroundColor: "#1a1b26",
      focusedTextColor: "#7aa2f7",
      placeholderColor: "#565f89",
      cursorColor: "#7aa2f7",
      onPaste(event) {
        this.insertText(event.text);
      },
    });
    formBox.add(urlInput);

    const submitHint = new TextRenderable(renderer, {
      id: "submit-hint",
      content: "\nTab: switch fields | Enter: submit | ESC: cancel",
      fg: "#565f89",
    });
    formBox.add(submitHint);

    content.add(formBox);

    const inputs = [companyInput, titleInput, urlInput];
    let currentInputIdx = 0;
    companyInput.focus();

    async function submitForm() {
      const company = companyInput.value?.trim();
      const title = titleInput.value?.trim();
      const url = urlInput.value?.trim() || undefined;

      if (!company) {
        showMessage("Company name is required");
        return;
      }
      if (!title) {
        showMessage("Job title is required");
        return;
      }

      try {
        const result = await addRole({ url, company, title });
        showMessage(`Added: ${result.company} - ${result.title}`);
        loadRoles();
        renderMainMenu();
      } catch (err) {
        showMessage(`Error: ${err}`);
      }
    }

    for (const input of inputs) {
      input.on(InputRenderableEvents.ENTER, () => {
        submitForm();
      });
    }

    renderer.keyInput.on("keypress", (key) => {
      if (state.screen !== "add-role") return;

      if (key.name === "tab") {
        currentInputIdx = (currentInputIdx + 1) % inputs.length;
        const nextInput = inputs[currentInputIdx];
        if (nextInput) nextInput.focus();
      }
    });
  }

  async function handleApply(roleId: string) {
    const root = findRoot();
    const db = getDb(dbPath(root));
    const userProfile = getUserProfile(db);

    if (!userProfile?.resume_text) {
      showMessage("Upload your resume in the web UI Settings first");
      return;
    }

    showMessage("Generating cover letter...");

    try {
      const result = await applyToRole(roleId);
      showMessage(`Applied! See: ${result.pdfPath}`);
      loadRoles();
      renderPipeline();
    } catch (err) {
      showMessage(`Error: ${err}`);
    }
  }

  function renderProfile() {
    if (!state.workspaceReady) {
      showMessage("Initialize workspace first");
      return;
    }

    clearContent();
    state.screen = "profile";

    const profileBox = new BoxRenderable(renderer, {
      id: "profile-box",
      width: 60,
      backgroundColor: "#1f2335",
      border: false,
      flexDirection: "column",
      padding: 2,
    });

    const profileHeader = new TextRenderable(renderer, {
      id: "profile-header",
      content: "Profile (ESC to go back)\n",
      fg: "#bb9af7",
    });
    profileBox.add(profileHeader);

    const profileMenu = new SelectRenderable(renderer, {
      id: "profile-menu",
      width: "100%",
      height: 9,
      options: [
        { name: "Open Web UI", description: "Manage profile at http://localhost:3001" },
        { name: "Back", description: "Return to main menu" },
      ],
      backgroundColor: "#1f2335",
      textColor: "#c0caf5",
      focusedBackgroundColor: "#1f2335",
      focusedTextColor: "#c0caf5",
      selectedBackgroundColor: "#7aa2f7",
      selectedTextColor: "#13141c",
      descriptionColor: "#565f89",
      selectedDescriptionColor: "#13141c",
    });

    profileMenu.on(SelectRenderableEvents.ITEM_SELECTED, () => {
      const option = profileMenu.getSelectedOption();
      if (!option) return;

      switch (option.name) {
        case "Open Web UI":
          showMessage("Open http://localhost:3001/settings in your browser");
          break;
        case "Back":
          renderMainMenu();
          break;
      }
    });

    profileBox.add(profileMenu);
    content.add(profileBox);
    profileMenu.focus();
  }

  async function renderDoctor() {
    clearContent();
    state.screen = "doctor";

    const doctorBox = new BoxRenderable(renderer, {
      id: "doctor-box",
      width: "100%",
      height: "100%",
      backgroundColor: "#1f2335",
      border: false,
      flexDirection: "column",
      padding: 2,
    });

    const doctorHeader = new TextRenderable(renderer, {
      id: "doctor-header",
      content: "System Check (ESC to go back)\n",
      fg: "#bb9af7",
    });
    doctorBox.add(doctorHeader);

    const results = await runDoctor();

    for (const result of results) {
      const icon = result.ok ? "✓" : "✗";
      const color = result.ok ? "#9ece6a" : "#f7768e";
      const text = new TextRenderable(renderer, {
        id: `doctor-${result.label}`,
        content: `${icon} ${result.label}`,
        fg: color,
      });
      doctorBox.add(text);
    }

    content.add(doctorBox);
  }

  function renderReview() {
    if (!state.workspaceReady) {
      showMessage("Initialize workspace first");
      return;
    }

    clearContent();
    state.screen = "review";

    const reviewBox = new BoxRenderable(renderer, {
      id: "review-box",
      width: "100%",
      height: "100%",
      backgroundColor: "#1f2335",
      border: false,
      flexDirection: "column",
      padding: 2,
    });

    const reviewHeader = new TextRenderable(renderer, {
      id: "review-header",
      content: "Weekly Review (ESC to go back)",
      fg: "#bb9af7",
    });
    reviewBox.add(reviewHeader);

    const data = getReviewData();

    const tasksHeader = new TextRenderable(renderer, {
      id: "tasks-header",
      content: "\n📋 Pending Tasks:",
      fg: "#bb9af7",
    });
    reviewBox.add(tasksHeader);

    if (data.tasks.length === 0) {
      const noTasks = new TextRenderable(renderer, {
        id: "no-tasks",
        content: "  No pending tasks",
        fg: "#565f89",
      });
      reviewBox.add(noTasks);
    } else {
      for (const task of data.tasks.slice(0, 5)) {
        const taskText = new TextRenderable(renderer, {
          id: `task-${task.kind}-${task.company_name}`,
          content: `  • [${task.kind}] ${task.company_name} - ${task.role_title}`,
          fg: "#c0caf5",
        });
        reviewBox.add(taskText);
      }
    }

    const statusHeader = new TextRenderable(renderer, {
      id: "status-header",
      content: "\n📊 Pipeline Status:",
      fg: "#bb9af7",
    });
    reviewBox.add(statusHeader);

    if (data.statusCounts.length === 0) {
      const noStatus = new TextRenderable(renderer, {
        id: "no-status",
        content: "  No applications yet",
        fg: "#565f89",
      });
      reviewBox.add(noStatus);
    } else {
      for (const status of data.statusCounts) {
        const statusText = new TextRenderable(renderer, {
          id: `status-${status.status}`,
          content: `  • ${status.status}: ${status.count}`,
          fg: "#c0caf5",
        });
        reviewBox.add(statusText);
      }
    }

    content.add(reviewBox);
  }

  function checkWorkspace() {
    try {
      findRoot();
      state.workspaceReady = true;
    } catch {
      state.workspaceReady = false;
    }
  }

  function loadRoles() {
    if (!state.workspaceReady) return;

    try {
      const root = findRoot();
      const db = getDb(dbPath(root));

      state.roles = db
        .query<RoleRow, []>(
          `SELECT r.id, r.title, c.name as company_name, a.status
           FROM roles r
           JOIN companies c ON r.company_id = c.id
           LEFT JOIN applications a ON a.role_id = r.id
           ORDER BY r.created_at DESC`
        )
        .all();
    } catch {
      state.roles = [];
    }
  }

  renderer.keyInput.on("keypress", (key) => {
    if (key.name === "q" && state.screen === "main") {
      renderer.destroy();
      process.exit(0);
    }

    if (key.name === "escape" && state.screen !== "main") {
      renderMainMenu();
    }
  });

  renderer.start();
  renderMainMenu();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
