import { html, render } from '@loop/core'
import { createProjectFile, downloadFile, PROJECT_FILE_EXTENSION, readProjectFile } from './project-file'
import type { ProjectSession } from './project-session'

export interface ProjectMenuElements {
  /** The popover with the project actions and the list of projects. */
  menu: HTMLElement
  list: HTMLElement
  nameInput: HTMLInputElement
  status: HTMLElement
  newButton: HTMLButtonElement
  importButton: HTMLButtonElement
  exportButton: HTMLButtonElement
  fileInput: HTMLInputElement
}

const STATUS_TEXT = { saved: 'Saved', saving: 'Saving…', error: 'Not saved!' } as const

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

/** Connect the project bar and the project menu to the session. */
export function connectProjectMenu(session: ProjectSession, elements: ProjectMenuElements) {
  const { menu, list, nameInput, status, newButton, importButton, exportButton, fileInput } = elements

  const renderList = async () => {
    const projects = await session.list()
    render(
      html`${projects.map(
        (project) => html`
          <li>
            <button type="button" class="menu-item" data-action="open" data-id="${project.id}" aria-current="${project.id === session.current.id}">
              <strong>${project.name}</strong>
              <small>${dateFormat.format(project.updatedAt)}</small>
            </button>
            <button type="button" class="button" data-variant="ghost" data-action="delete" data-id="${project.id}" aria-label="Delete ${project.name}">×</button>
          </li>
        `,
      )}`,
      list,
    )
  }

  /** Update the bar from the session. Call it from the session's onChange. */
  const update = () => {
    if (document.activeElement !== nameInput) nameInput.value = session.current.name
    status.textContent = STATUS_TEXT[session.status]
    status.dataset.status = session.status
    if (menu.matches(':popover-open')) void renderList()
  }

  // Refresh the list each time the menu opens.
  menu.addEventListener('beforetoggle', (event) => {
    if ((event as ToggleEvent).newState === 'open') void renderList()
  })

  list.addEventListener('click', async (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button[data-id]')
    if (!button) return
    const id = button.dataset.id!
    if (button.dataset.action === 'open') {
      await session.open(id)
      menu.hidePopover()
    } else {
      const name = button.getAttribute('aria-label')!.replace(/^Delete /, '')
      if (confirm(`Delete "${name}"? This cannot be undone. Export it first if you want to keep a copy.`)) {
        await session.delete(id)
        await renderList()
      }
    }
  })

  nameInput.addEventListener('change', () => session.rename(nameInput.value))

  newButton.addEventListener('click', async () => {
    await session.create()
    menu.hidePopover()
    nameInput.select()
  })

  exportButton.addEventListener('click', () => {
    downloadFile(createProjectFile(session.current.name, session.snapshot()))
  })

  fileInput.accept = `${PROJECT_FILE_EXTENSION},.json,application/json`
  importButton.addEventListener('click', () => fileInput.click())
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0]
    fileInput.value = '' // so the same file can be picked again
    if (!file) return
    try {
      const { name, project } = await readProjectFile(file)
      await session.create(name, project)
      menu.hidePopover()
    } catch (error) {
      alert(error instanceof Error ? error.message : String(error))
    }
  })

  update()
  return { update }
}
