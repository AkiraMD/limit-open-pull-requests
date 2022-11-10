import { PullRequest } from './pullRequest'
import { Client } from './client'
import * as core from '@actions/core'

export interface Limits {
  repoLimit?: number,
  perAuthorLimit?: number
}

export class Enforcer {
  private readonly client: Client
  private readonly limits: Limits
  private readonly triggeringPrNumber: number

  constructor(client: Client, limits: Limits, triggeringPrNumber: number) {
    this.client = client
    this.limits = limits
    this.triggeringPrNumber = triggeringPrNumber
  }

  async enforceLimits(): Promise<void>{
    const openPRs = await this.client.getOpenPullRequests()
    core.debug(JSON.stringify(openPRs))

    core.info(`Using the following limits: at most ${this.limits.repoLimit} open PRs, at most ${this.limits.perAuthorLimit} open PRs per author`)

    const triggeringPR: PullRequest | undefined = openPRs.find(pr => pr.number === this.triggeringPrNumber)

    if (triggeringPR) {
      if (this.closeBasedOnRepoLimit(openPRs)) {
        await this.client.closePullRequest(triggeringPR, "Sorry, this pull request will be closed. The limit for open pull requests was exceeded.")
      }

      if (this.closeBasedOnAuthorLimit(openPRs, triggeringPR)) {
        await this.client.closePullRequest(triggeringPR, "Sorry, this pull request will be closed. You have too many open PRs.")
      }
    } else {
      core.info("The triggering PR is closed, no action will be taken.");
    }
  }

  closeBasedOnRepoLimit(openPrs: PullRequest[]): boolean {
    if (!this.limits.repoLimit) {
      core.debug(`There is no repo PR limit set`)
      return false
    }

    core.debug(`Current number of open PRs in the repos is ${openPrs.length}`)
    if (this.limits.repoLimit > openPrs.length) {
      return false
    }

    core.debug(`There are more PRs open in this repo than the limit allows`)
    return true
  }

  closeBasedOnAuthorLimit(openPRs: PullRequest[], triggeringPR: PullRequest): boolean {
    if (!this.limits.perAuthorLimit) {
      core.debug(`There is no author PR limit set`)
      return false
    }

    const openPRsForAuthor = openPRs.filter(pr => pr.author === triggeringPR.author)
    core.debug(`Current number of open PRs for ${triggeringPR.author} is ${openPRsForAuthor.length}`)

    if (this.limits.perAuthorLimit > openPRsForAuthor.length) {
      return false
    }

    core.debug(`The author of this PRs has more PRs open than the limit allows`)
    return true
  }
}
