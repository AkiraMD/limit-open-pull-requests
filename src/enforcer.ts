import { PullRequest } from './pullRequest'
import { Client } from './client'
import * as core from '@actions/core'

export interface Limits {
  repoLimit?: number
  perAuthorLimit?: number
  perLabelLimit?: number
  limitedLabels?: string[]
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

  async enforceLimits(): Promise<void> {
    const openPRs = await this.client.getOpenPullRequests()
    core.debug(JSON.stringify(openPRs))

    const perLabelLimitDisplay =
      this.limits.perLabelLimit !== undefined ? String(this.limits.perLabelLimit) : 'none'
    const limitedLabelsDisplay =
      this.limits.limitedLabels && this.limits.limitedLabels.length
        ? this.limits.limitedLabels.join(', ')
        : 'none'

    core.info(
      `Using the following limits: at most ${this.limits.repoLimit} open PRs, at most ${
        this.limits.perAuthorLimit
      } open PRs per author, at most ${perLabelLimitDisplay} for each of these labels: ${limitedLabelsDisplay}`
    )

    const triggeringPR: PullRequest | undefined = openPRs.find(
      (pr) => pr.number === this.triggeringPrNumber
    )

    if (triggeringPR) {
      if (this.closeBasedOnRepoLimit(openPRs)) {
        await this.client.closePullRequest(
          triggeringPR,
          'Sorry, this pull request will be closed. The limit for open pull requests was exceeded.'
        )
        return
      }

      if (this.closeBasedOnAuthorLimit(openPRs, triggeringPR)) {
        const openPRsForAuthor = openPRs.filter((pr) => pr.author === triggeringPR.author)
        const sortedOtherOpenPRsForAuthor = openPRsForAuthor
          .filter((pr) => pr.number !== triggeringPR.number)
          .sort((a, b) => a.number - b.number)

        const otherOpenPRNumbers = sortedOtherOpenPRsForAuthor.map((pr) => `#${pr.number}`).join(', ')
        const otherOpenPRDetails = sortedOtherOpenPRsForAuthor
          .map(
            (pr) =>
              `- #${pr.number} (${pr.draft ? 'draft' : 'ready'}; ${pr.headRef} -> ${pr.baseRef})`
          )
          .join('\n')

        const limit = this.limits.perAuthorLimit
        const header =
          `Sorry, this pull request will be closed. ` +
          `You have too many open PRs (limit: ${limit}).`

        const details =
          sortedOtherOpenPRsForAuthor.length > 0
            ? `\n\nOther open PRs counted for @${triggeringPR.author}: ${otherOpenPRNumbers}\n${otherOpenPRDetails}`
            : `\n\nNo other open PRs were found for @${triggeringPR.author} (unexpected if limit exceeded).`

        await this.client.closePullRequest(triggeringPR, `${header}${details}`)
        return
      }

      if (this.closeBasedOnLabelLimits(openPRs, triggeringPR)) {
        await this.client.closePullRequest(
          triggeringPR,
          'Sorry, this pull request will be closed. The limit for open PRs with these labels was exceeded.'
        )
        return
      }
    } else {
      core.info('The triggering PR is closed, no action will be taken.')
    }
  }

  closeBasedOnRepoLimit(openPrs: PullRequest[]): boolean {
    if (!this.limits.repoLimit) {
      core.debug(`There is no repo PR limit set`)
      return false
    }

    core.debug(`Current number of open PRs in the repos is ${openPrs.length}`)
    if (openPrs.length > this.limits.repoLimit) {
      core.debug(`There are more PRs open in this repo than the limit allows`)
      return true
    }

    core.debug(`This PR has not been limited by the amount of PRs currently open in this repo`)
    return false
  }

  closeBasedOnAuthorLimit(openPRs: PullRequest[], triggeringPR: PullRequest): boolean {
    if (!this.limits.perAuthorLimit) {
      core.debug(`There is no author PR limit set`)
      return false
    }

    const openPRsForAuthor = openPRs.filter((pr) => pr.author === triggeringPR.author)
    core.debug(
      `Current number of open PRs for ${triggeringPR.author} is ${openPRsForAuthor.length}`
    )

    if (openPRsForAuthor.length > this.limits.perAuthorLimit) {
      core.debug(`The author of this PRs has more PRs open than the limit allows`)
      return true
    }

    core.debug(`This PR has not been limited by the amount of PRs the author has open`)
    return false
  }

  closeBasedOnLabelLimits(openPRs: PullRequest[], triggeringPR: PullRequest): boolean {
    const { perLabelLimit, limitedLabels } = this.limits

    if (!perLabelLimit) {
      core.debug(`There are no label PR limits set`)
      return false
    }

    if (!limitedLabels || !limitedLabels.length) {
      core.debug(`There are no label specified to be limited`)
      return false
    }

    const limitedLabelsOnPr = triggeringPR.labels.filter((prLabel) =>
      limitedLabels.includes(prLabel)
    )
    if (!limitedLabelsOnPr.length) {
      core.debug(`This PR does not have any labels that need to be limited`)
      return false
    }

    core.debug(`This PR has the following limited labels: ${limitedLabelsOnPr.join(', ')}.`)

    const openPRsWithLimitedLabels = openPRs.filter((openPr) => {
      return openPr.labels.some((label) => limitedLabels.includes(label))
    })

    if (!openPRsWithLimitedLabels.length) {
      core.debug('There are no other open PRs that have limited labels')
      return false
    }

    const labelCounts: { [label: string]: number } = limitedLabelsOnPr.reduce((counts, label) => {
      let currentLabelCount = 1
      openPRsWithLimitedLabels.forEach((prLabels) => {
        if (prLabels.labels.includes(label)) {
          currentLabelCount += 1
        }
      })
      return { ...counts, [label]: currentLabelCount }
    }, {})

    if (Object.values(labelCounts).every((count) => perLabelLimit >= count)) {
      core.debug("This PR has not been limited by it's labels")
      return false
    }

    core.debug('There are too many open PRs with these labels')
    return true
  }
}
