import { type ProjectData, parseProject } from '@loop/core'

/** The content of an exported project file. */
export interface ProjectFile {
  format: 'loop-project'
  name: string
  project: ProjectData
}

export const PROJECT_FILE_EXTENSION = '.loop.json'

/** Make a downloadable file for a project. */
export function createProjectFile(name: string, project: ProjectData): File {
  const content: ProjectFile = { format: 'loop-project', name, project }
  const fileName =
    (name.trim() || 'project').replace(/[\\/:*?"<>|]+/g, '-') +
    PROJECT_FILE_EXTENSION
  return new File([JSON.stringify(content, null, 2)], fileName, {
    type: 'application/json',
  })
}

/** Read a project file. Throws an Error with a message for the user if the file is not valid. */
export async function readProjectFile(
  file: File,
): Promise<{ name: string; project: ProjectData }> {
  let json: unknown
  try {
    json = JSON.parse(await file.text())
  } catch {
    throw new Error(`"${file.name}" is not a project file.`)
  }
  const content = json as Partial<ProjectFile> | null
  const project =
    content?.format === 'loop-project'
      ? parseProject(content.project)
      : undefined
  if (!project) throw new Error(`"${file.name}" is not a project file.`)
  const name =
    typeof content?.name === 'string' && content.name.trim()
      ? content.name.trim()
      : file.name.replace(PROJECT_FILE_EXTENSION, '').replace(/\.json$/, '')
  return { name, project }
}

/** Let the browser download a file (native: a temporary link with `download`). */
export function downloadFile(file: File): void {
  const url = URL.createObjectURL(file)
  const link = Object.assign(document.createElement('a'), {
    href: url,
    download: file.name,
  })
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
