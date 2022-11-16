import * as github from '@actions/github'
import { Octokit } from '@octokit/core'
import { Api } from '@octokit/plugin-rest-endpoint-methods/dist-types/types'
import { PullRequest, PullRequestState } from './pullRequest'

export class Client {
  private readonly client: Octokit & Api
  private readonly repoOwner: string
  private readonly repoName: string
  private openPRs: Array<PullRequest>

  constructor(repoToken: string, repoOwner: string, repoName: string) {
    this.client = github.getOctokit(repoToken)
    this.repoOwner = repoOwner
    this.repoName = repoName
    this.openPRs = new Array<PullRequest>()
  }

  async getOpenPullRequests(): Promise<Array<PullRequest>> {
    const reviewRequest = this.client.rest.pulls.list({
      owner: this.repoOwner,
      repo: this.repoName,
      state: PullRequestState.Open,
    })

    const result = await reviewRequest
    const openPullRequests = result.data

    for (const prItem of openPullRequests) {
      const pr = new PullRequest(prItem)
      this.openPRs.push(pr)
    }

    return this.openPRs
  }

  async closePullRequest(pullRequest: PullRequest, comment: string): Promise<void> {
    await this.client.rest.issues.createComment({
      issue_number: pullRequest.number,
      owner: this.repoOwner,
      repo: this.repoName,
      body: comment,
    })

    await this.client.rest.pulls.update({
      pull_number: pullRequest.number,
      owner: this.repoOwner,
      repo: this.repoName,
      state: PullRequestState.Closed,
    })
  }
}
