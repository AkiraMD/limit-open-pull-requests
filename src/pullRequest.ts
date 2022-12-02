export enum PullRequestState {
  Open = 'open',
  Closed = 'closed',
}

export class PullRequest {
  id: number
  number: number
  author: string
  draft: boolean
  headRef: string
  baseRef: string
  labels: string[]

  // Come back and figure out this type
  constructor(pullRequestItem) {
    this.id = pullRequestItem.id
    this.number = pullRequestItem.number
    this.author = pullRequestItem.user.login
    this.draft = pullRequestItem.draft
    this.headRef = pullRequestItem.head.ref
    this.baseRef = pullRequestItem.base.ref
    this.labels = pullRequestItem.labels.map((label: { name: string }) => label.name)
  }
}
